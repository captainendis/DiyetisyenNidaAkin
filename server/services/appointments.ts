// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevu iş mantığı
 * ──────────────────
 *  - DTO dönüştürme (İstanbul saatine göre tarih/saat)
 *  - Durum geçiş kuralları + durum geçmişi
 *  - Onayda danışan eşleştirme / oluşturma
 *  - Tüm zaman yazan işlemler withAppointmentLock + assertSlotAllowed ile yapılır
 */
import { prisma, type Tx, type Prisma } from '../lib/db';
import { badRequest, conflict, notFound, type Ctx } from '../lib/http';
import { audit } from '../lib/audit';
import { notifyStaff } from './notifications';
import { appointmentLocalParts, assertSlotAllowed, withAppointmentLock } from './availability';
import {
  APPOINTMENT_STATUS_LABEL,
  HARD_CONFLICT_STATUSES,
  SLOT_HOLDING_STATUSES,
  parseDayparts,
  parseDays,
  type AppointmentKind,
  type AppointmentStatus,
  type MeetingType,
  type PilatesFormat,
} from '../../shared/constants';
import { formatDateTime, isoWeekday } from '../../shared/time';
import { whatsappNotifyClient } from './whatsapp';
import { pushToClient, shortWhen } from './push';

export const appointmentInclude = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  service: { select: { id: true, title: true, durationMinutes: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export function toDTO(a: AppointmentRow) {
  const { date, time } = appointmentLocalParts(a.startsAt);
  return {
    id: a.id,
    status: a.status as AppointmentStatus,
    meetingType: a.meetingType as MeetingType,
    kind: a.kind as AppointmentKind,
    pilatesFormat: a.pilatesFormat as PilatesFormat | null,
    preferredDays: parseDays(a.preferredDays),
    preferredDayparts: parseDayparts(a.preferredDayparts),
    source: a.source,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    date,
    time,
    durationMinutes: a.startsAt && a.endsAt ? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000) : null,
    contactName: a.contactName,
    contactPhone: a.contactPhone,
    contactEmail: a.contactEmail,
    clientMessage: a.clientMessage,
    internalNote: a.internalNote,
    createdAt: a.createdAt,
    explicitConsentAt: a.explicitConsentAt,
    kvkkNoticeAcceptedAt: a.kvkkNoticeAcceptedAt,
    client: a.client,
    service: a.service ? { id: a.service.id, title: a.service.title } : null,
  };
}
export type AppointmentDTO = ReturnType<typeof toDTO>;

/** Varsayılan süre: hizmet süresi → o günün kural süresi → 45 dk */
export async function resolveDuration(db: Tx | typeof prisma, opts: { serviceId?: string | null; weekday?: number; explicit?: number }) {
  if (opts.explicit) return opts.explicit;
  if (opts.serviceId) {
    const s = await db.service.findUnique({ where: { id: opts.serviceId }, select: { durationMinutes: true } });
    if (s?.durationMinutes) return s.durationMinutes;
  }
  if (opts.weekday) {
    const r = await db.availabilityRule.findUnique({ where: { weekday: opts.weekday }, select: { slotMinutes: true } });
    if (r) return r.slotMinutes;
  }
  return 45;
}

/** Telefon veya e-postaya göre mevcut danışanı bulur */
export async function findClientByContact(db: Tx | typeof prisma, phone: string, email: string | null) {
  const or: Prisma.ClientWhereInput[] = [{ phone }];
  if (email) or.push({ email: { equals: email } });
  return db.client.findFirst({ where: { OR: or }, orderBy: { createdAt: 'asc' }, select: { id: true } });
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** İzin verilen durum geçişleri */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  NEW_REQUEST: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING'],
  COMPLETED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED', 'COMPLETED'],
  CANCELLED: ['CONFIRMED', 'PENDING'],
};

export async function getAppointmentOr404(id: string, db: Tx | typeof prisma = prisma) {
  const a = await db.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!a) throw notFound('Randevu bulunamadı');
  return a;
}

/**
 * Durum değişikliği. CONFIRMED'e geçişte kesin çakışma kontrolü yapılır ve
 * danışan kaydı yoksa eşleştirilir / oluşturulur.
 */
export async function changeStatus(c: Ctx, id: string, to: AppointmentStatus, note: string | null | undefined) {
  let createdClient: { id: string; name: string } | null = null;
  let changed = false;

  const updated = await withAppointmentLock(async (tx) => {
    const a = await getAppointmentOr404(id, tx);
    const from = a.status as AppointmentStatus;
    if (from === to) return a;
    changed = true;
    if (!TRANSITIONS[from].includes(to)) {
      throw conflict('INVALID_TRANSITION', `"${APPOINTMENT_STATUS_LABEL[from]}" durumundaki randevu "${APPOINTMENT_STATUS_LABEL[to]}" durumuna alınamaz.`);
    }
    if ((to === 'CONFIRMED' || to === 'PENDING' || to === 'COMPLETED' || to === 'NO_SHOW') && !a.startsAt) {
      throw badRequest('Bu işlem için önce randevuya tarih ve saat atanmalı.');
    }
    if ((to === 'CONFIRMED' || to === 'PENDING') && a.startsAt && a.endsAt && !HARD_CONFLICT_STATUSES.includes(from)) {
      const { date, time } = appointmentLocalParts(a.startsAt);
      const dur = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
      // Onayda: yalnızca kesin (onaylı/tamamlanmış) çakışma engeller; geçmiş tarihli kaydı yeniden onaylamaya izin ver.
      await assertSlotAllowed(
        tx,
        { date: date!, time: time!, durationMinutes: dur, ignoreAppointmentId: a.id },
        { statuses: HARD_CONFLICT_STATUSES, enforceHours: false, allowPast: true },
      );
    }

    let clientId = a.clientId;
    if (to === 'CONFIRMED' && !clientId) {
      const existing = await findClientByContact(tx, a.contactPhone, a.contactEmail);
      if (existing) clientId = existing.id;
      else {
        const { firstName, lastName } = splitName(a.contactName);
        const c = await tx.client.create({
          data: {
            firstName,
            lastName,
            phone: a.contactPhone,
            email: a.contactEmail,
            source: a.source,
            preferredMeetingType: a.meetingType,
            kvkkNoticeAt: a.kvkkNoticeAcceptedAt,
            firstVisitDate: appointmentLocalParts(a.startsAt).date,
          },
        });
        clientId = c.id;
        createdClient = { id: c.id, name: a.contactName };
      }
    }

    const row = await tx.appointment.update({
      where: { id },
      data: { status: to, clientId, ...(to === 'CONFIRMED' ? { reminderNotifiedAt: null } : {}) },
      include: appointmentInclude,
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: id, fromStatus: from, toStatus: to, note: note || null, changedById: c.var.user?.id ?? null },
    });
    await audit(c, 'appointment.status_changed', 'appointment', id, { from, to }, tx);
    return row;
  });

  if (createdClient) {
    const c = createdClient as { id: string; name: string };
    await notifyStaff('CLIENT_CREATED', { title: `Yeni danışan kaydı: ${c.name}`, body: 'Randevu onayıyla birlikte oluşturuldu.', clientId: c.id, appointmentId: id });
  }
  const when = updated.startsAt ? formatDateTime(updated.startsAt) : 'Tarih belirlenmedi';
  if (to === 'CONFIRMED') {
    void whatsappNotifyClient('confirmedClient', id);
    await notifyStaff('APPOINTMENT_CONFIRMED', { title: `Randevu onaylandı: ${updated.contactName}`, body: when, appointmentId: id, clientId: updated.clientId });
    // Danışanın mobil uygulamasına (hesabı ve kayıtlı cihazı varsa); not/sağlık bilgisi içermez
    if (changed) pushToClient(updated.clientId, { title: 'Randevun onaylandı', body: shortWhen(updated.startsAt), url: '/hesabim/randevular', data: { type: 'APPOINTMENT_CONFIRMED' } });
  } else if (to === 'CANCELLED') {
    await notifyStaff('APPOINTMENT_CANCELLED', { title: `Randevu iptal edildi: ${updated.contactName}`, body: note ? `${when} — ${note}` : when, appointmentId: id, clientId: updated.clientId });
    if (changed) pushToClient(updated.clientId, { title: 'Randevun iptal edildi', body: shortWhen(updated.startsAt) || null, url: '/hesabim/randevular', data: { type: 'APPOINTMENT_CANCELLED' } });
  }
  return updated;
}

/** Tarih/saat/süre değişikliği (yeniden planlama) */
export async function reschedule(
  c: Ctx,
  id: string,
  input: { date?: string; time?: string; durationMinutes?: number; allowOutsideHours?: boolean; extra?: Prisma.AppointmentUpdateInput },
) {
  let movedConfirmed = false;
  const row = await withAppointmentLock(async (tx) => {
    const a = await getAppointmentOr404(id, tx);
    const cur = appointmentLocalParts(a.startsAt);
    const timeChange = input.date !== undefined || input.time !== undefined || input.durationMinutes !== undefined;
    let timeData: { startsAt: Date; endsAt: Date } | null = null;

    if (timeChange) {
      const date = input.date ?? cur.date;
      const time = input.time ?? cur.time;
      if (!date || !time) throw badRequest('Tarih ve saat birlikte girilmeli.');
      const curDur = a.startsAt && a.endsAt ? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000) : undefined;
      const duration = input.durationMinutes ?? curDur ?? (await resolveDuration(tx, { serviceId: a.serviceId, weekday: isoWeekday(date) }));
      const status = a.status as AppointmentStatus;
      if (status === 'COMPLETED' || status === 'NO_SHOW') throw conflict('INVALID_TRANSITION', 'Sonuçlanmış bir randevunun zamanı değiştirilemez.');
      timeData = await assertSlotAllowed(
        tx,
        { date, time, durationMinutes: duration, ignoreAppointmentId: id },
        {
          statuses: HARD_CONFLICT_STATUSES.includes(status) ? HARD_CONFLICT_STATUSES : SLOT_HOLDING_STATUSES,
          enforceHours: !input.allowOutsideHours,
          allowPast: false,
        },
      );
    }

    const newStatus: AppointmentStatus | undefined = timeData && a.status === 'NEW_REQUEST' ? 'PENDING' : undefined;
    const row = await tx.appointment.update({
      where: { id },
      data: {
        ...(input.extra ?? {}),
        ...(timeData ? { ...timeData, reminderNotifiedAt: null } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      },
      include: appointmentInclude,
    });
    if (timeData && (a.startsAt?.getTime() !== timeData.startsAt.getTime() || a.endsAt?.getTime() !== timeData.endsAt.getTime())) {
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: id,
          fromStatus: a.status,
          toStatus: newStatus ?? a.status,
          previousStartsAt: a.startsAt,
          newStartsAt: timeData.startsAt,
          note: 'Tarih/saat güncellendi',
          changedById: c.var.user?.id ?? null,
        },
      });
      await audit(c, 'appointment.rescheduled', 'appointment', id, {}, tx);
      movedConfirmed = a.status === 'CONFIRMED' && a.startsAt?.getTime() !== timeData.startsAt.getTime();
    } else if (input.extra && Object.keys(input.extra).length) {
      await audit(c, 'appointment.updated', 'appointment', id, { fields: Object.keys(input.extra) }, tx);
    }
    return row;
  });
  // Onaylı randevunun saati değişti → danışanın mobil uygulamasına
  if (movedConfirmed) pushToClient(row.clientId, { title: 'Randevunun saati değişti', body: shortWhen(row.startsAt), url: '/hesabim/randevular', data: { type: 'APPOINTMENT_RESCHEDULED' } });
  return row;
}
