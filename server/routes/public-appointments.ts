// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Web sitesi randevu talebi uçları (oturum gerektirmez).
 * Yanıtlarda hiçbir kişisel veri / diğer randevuların detayları dönmez — yalnızca boş/dolu bilgisi.
 */
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, badRequest, body, conflict, parse, query, router } from '../lib/http';
import { audit } from '../lib/audit';
import { publicFormLimiter } from '../middleware/rate-limit';
import { getSetting, getSettings } from '../services/settings';
import { assertSlotAllowed, getSlots, withAppointmentLock } from '../services/availability';
import { findClientByContact, resolveDuration } from '../services/appointments';
import { notifyStaff } from '../services/notifications';
import { dateStr, publicAppointmentRequestSchema } from '../../shared/schemas';
import { DAYPARTS, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, SLOT_HOLDING_STATUSES, pilatesPreferenceText } from '../../shared/constants';
import { addDays, eachDay, formatDateTime, isoWeekday, todayStr } from '../../shared/time';

export const publicAppointmentsRouter = router();

async function publishedServiceDuration(serviceId?: string | null) {
  if (!serviceId) return undefined;
  const s = await prisma.service.findFirst({ where: { id: serviceId, isPublished: true }, select: { durationMinutes: true } });
  return s?.durationMinutes ?? undefined;
}

const daysQuery = z.object({ from: dateStr.optional(), to: dateStr.optional(), serviceId: z.string().max(40).optional() });

publicAppointmentsRouter.get('/availability/days', async (c) => {
  const q = parse(daysQuery, query(c));
  const cfg = await getSetting('appointment');
  const today = todayStr();
  const max = addDays(today, cfg.maxDaysAhead);
  const from = q.from && q.from > today ? q.from : today;
  let to = q.to && q.to < max ? q.to : max;
  if (to > addDays(from, 62)) to = addDays(from, 62);
  const duration = await publishedServiceDuration(q.serviceId);
  const days: { date: string; available: number }[] = [];
  if (from <= to) {
    for (const date of eachDay(from, to)) {
      const { slots } = await getSlots(date, { forPublic: true, leadTimeHours: cfg.leadTimeHours, durationMinutes: duration });
      days.push({ date, available: slots.filter((s) => s.available).length });
    }
  }
  return c.json({ days, leadTimeHours: cfg.leadTimeHours, maxDaysAhead: cfg.maxDaysAhead });
});

const slotsQuery = z.object({ date: dateStr, serviceId: z.string().max(40).optional() });

publicAppointmentsRouter.get('/availability/slots', async (c) => {
  const q = parse(slotsQuery, query(c));
  const cfg = await getSetting('appointment');
  const today = todayStr();
  if (q.date < today || q.date > addDays(today, cfg.maxDaysAhead)) {
    return c.json({ date: q.date, closedReason: 'Bu tarih için talep alınmıyor', slots: [] });
  }
  const duration = await publishedServiceDuration(q.serviceId);
  const { plan, slots } = await getSlots(q.date, { forPublic: true, leadTimeHours: cfg.leadTimeHours, durationMinutes: duration });
  return c.json({ date: q.date, closedReason: plan.isWorking ? null : plan.closedReason, slots });
});

publicAppointmentsRouter.post('/appointments', publicFormLimiter, async (c) => {
  // Bot tuzağı: görünmeyen alan doluysa kayıt yapılmaz
  const raw = (await body(c)) as { website?: unknown } | null;
  if (typeof raw?.website === 'string' && raw.website.trim() !== '') {
    throw badRequest('Talep işlenemedi.');
  }
  const input = parse(publicAppointmentRequestSchema, await body(c));
  const { appointment: cfg, contact } = await getSettings(['appointment', 'contact'] as const);

  const pilates = input.kind === 'PILATES';
  // Pilates dersleri stüdyoda ve saati birlikte planlanarak yapılır; danışmanlık ayarları uygulanmaz
  if (!pilates) {
    if (input.meetingType === 'IN_PERSON' && !cfg.inPersonEnabled) throw badRequest('Yüz yüze görüşme şu anda sunulmuyor.');
    if (input.meetingType === 'ONLINE' && !cfg.onlineEnabled) throw badRequest('Online görüşme şu anda sunulmuyor.');
    if (input.mode === 'callback' && !cfg.allowRequestWithoutTime) throw badRequest('Lütfen bir gün ve saat seçin.');
  }

  let serviceId: string | null = null;
  if (input.serviceId && !pilates) {
    const s = await prisma.service.findFirst({ where: { id: input.serviceId, isPublished: true }, select: { id: true } });
    serviceId = s?.id ?? null;
  }

  const now = new Date();
  const created = await withAppointmentLock(async (tx) => {
    let times: { startsAt: Date; endsAt: Date } | null = null;
    if (input.mode === 'slot') {
      const date = input.date!;
      const time = input.time!;
      const duration = await resolveDuration(tx, { serviceId, weekday: isoWeekday(date) });
      try {
        times = await assertSlotAllowed(
          tx,
          { date, time, durationMinutes: duration },
          { statuses: SLOT_HOLDING_STATUSES, enforceHours: true, leadTimeHours: cfg.leadTimeHours, maxDaysAhead: cfg.maxDaysAhead },
        );
      } catch (e) {
        // Diğer randevulara ait hiçbir bilgi (kimlik, durum) ziyaretçiye dönmez
        if (e instanceof HttpError && e.code === 'CONFLICT') {
          throw conflict('SLOT_TAKEN', 'Seçtiğiniz saat az önce doldu. Lütfen başka bir saat seçin.');
        }
        if (e instanceof HttpError) throw new HttpError(e.status, e.code, e.message);
        throw e;
      }
    }
    // Aynı kişiden aynı anda tekrar eden talepleri engelle (çift tıklama vb.)
    const dup = await tx.appointment.findFirst({
      where: {
        contactPhone: input.phone,
        source: 'WEBSITE',
        status: { in: ['NEW_REQUEST', 'PENDING'] },
        kind: input.kind,
        createdAt: { gt: new Date(now.getTime() - 10 * 60_000) },
        ...(times ? { startsAt: times.startsAt } : { startsAt: null }),
      },
      select: { id: true },
    });
    if (dup) throw conflict('DUPLICATE_REQUEST', 'Bu talep zaten alındı. Kısa süre içinde sizinle iletişime geçilecek.');

    const client = await findClientByContact(tx, input.phone, input.email);
    const status = times ? 'PENDING' : 'NEW_REQUEST';
    const a = await tx.appointment.create({
      data: {
        clientId: client?.id ?? null,
        serviceId,
        contactName: input.fullName.replace(/\s+/g, ' ').trim(),
        contactPhone: input.phone,
        contactEmail: input.email,
        startsAt: times?.startsAt ?? null,
        endsAt: times?.endsAt ?? null,
        meetingType: input.meetingType,
        kind: input.kind,
        pilatesFormat: pilates ? input.pilatesFormat : null,
        preferredDays: pilates && input.preferredDays?.length ? [...new Set(input.preferredDays)].sort().join(',') : null,
        preferredDayparts: pilates && input.preferredDayparts?.length ? DAYPARTS.filter((d) => input.preferredDayparts!.includes(d)).join(',') : null,
        status,
        source: 'WEBSITE',
        clientMessage: input.message?.trim() || null,
        kvkkNoticeAcceptedAt: now,
        explicitConsentAt: input.explicitConsent ? now : null,
      },
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: a.id, fromStatus: null, toStatus: status, note: 'Web sitesinden talep' },
    });
    return a;
  });

  await audit(c, 'appointment.requested_public', 'appointment', created.id, { mode: input.mode, meetingType: input.meetingType, kind: input.kind });
  await notifyStaff('APPOINTMENT_REQUESTED', {
    title: pilates ? `Yeni pilates talebi: ${created.contactName}` : `Yeni randevu talebi: ${created.contactName}`,
    body: pilates
      ? `${PILATES_FORMAT_LABEL[input.pilatesFormat!]} · ${pilatesPreferenceText(created.preferredDays, created.preferredDayparts)}`
      : `${created.startsAt ? formatDateTime(created.startsAt) : 'Saat seçilmedi — geri arama talebi'} · ${MEETING_TYPE_LABEL[created.meetingType]}`,
    appointmentId: created.id,
    clientId: created.clientId,
  });

  return c.json({
    ok: true,
    status: created.status,
    reference: created.id.slice(-6).toUpperCase(),
    whatsapp: contact.whatsapp,
  }, 201);
});
