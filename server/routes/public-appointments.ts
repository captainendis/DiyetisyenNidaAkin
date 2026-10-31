/**
 * Web sitesi randevu talebi uçları (oturum gerektirmez).
 * Yanıtlarda hiçbir kişisel veri / diğer randevuların detayları dönmez — yalnızca boş/dolu bilgisi.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { HttpError, badRequest, conflict, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { publicFormLimiter } from '../middleware/rate-limit';
import { getSetting, getSettings } from '../services/settings';
import { assertSlotAllowed, getSlots, withAppointmentLock } from '../services/availability';
import { findClientByContact, resolveDuration } from '../services/appointments';
import { notifyStaff } from '../services/notifications';
import { dateStr, publicAppointmentRequestSchema } from '../../shared/schemas';
import { MEETING_TYPE_LABEL, SLOT_HOLDING_STATUSES } from '../../shared/constants';
import { addDays, eachDay, formatDateTime, isoWeekday, todayStr } from '../../shared/time';

export const publicAppointmentsRouter = Router();

async function publishedServiceDuration(serviceId?: string | null) {
  if (!serviceId) return undefined;
  const s = await prisma.service.findFirst({ where: { id: serviceId, isPublished: true }, select: { durationMinutes: true } });
  return s?.durationMinutes ?? undefined;
}

const daysQuery = z.object({ from: dateStr.optional(), to: dateStr.optional(), serviceId: z.string().max(40).optional() });

publicAppointmentsRouter.get('/availability/days', async (req, res) => {
  const q = parse(daysQuery, req.query);
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
  res.json({ days, leadTimeHours: cfg.leadTimeHours, maxDaysAhead: cfg.maxDaysAhead });
});

const slotsQuery = z.object({ date: dateStr, serviceId: z.string().max(40).optional() });

publicAppointmentsRouter.get('/availability/slots', async (req, res) => {
  const q = parse(slotsQuery, req.query);
  const cfg = await getSetting('appointment');
  const today = todayStr();
  if (q.date < today || q.date > addDays(today, cfg.maxDaysAhead)) {
    return res.json({ date: q.date, closedReason: 'Bu tarih için talep alınmıyor', slots: [] });
  }
  const duration = await publishedServiceDuration(q.serviceId);
  const { plan, slots } = await getSlots(q.date, { forPublic: true, leadTimeHours: cfg.leadTimeHours, durationMinutes: duration });
  res.json({ date: q.date, closedReason: plan.isWorking ? null : plan.closedReason, slots });
});

publicAppointmentsRouter.post('/appointments', publicFormLimiter, async (req, res) => {
  // Bot tuzağı: görünmeyen alan doluysa kayıt yapılmaz
  if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
    throw badRequest('Talep işlenemedi.');
  }
  const input = parse(publicAppointmentRequestSchema, req.body);
  const { appointment: cfg, contact } = await getSettings(['appointment', 'contact'] as const);

  if (input.meetingType === 'IN_PERSON' && !cfg.inPersonEnabled) throw badRequest('Yüz yüze görüşme şu anda sunulmuyor.');
  if (input.meetingType === 'ONLINE' && !cfg.onlineEnabled) throw badRequest('Online görüşme şu anda sunulmuyor.');
  if (input.mode === 'callback' && !cfg.allowRequestWithoutTime) throw badRequest('Lütfen bir gün ve saat seçin.');

  let serviceId: string | null = null;
  if (input.serviceId) {
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

  await audit(req, 'appointment.requested_public', 'appointment', created.id, { mode: input.mode, meetingType: input.meetingType });
  await notifyStaff('APPOINTMENT_REQUESTED', {
    title: `Yeni randevu talebi: ${created.contactName}`,
    body: `${created.startsAt ? formatDateTime(created.startsAt) : 'Saat seçilmedi — geri arama talebi'} · ${MEETING_TYPE_LABEL[created.meetingType]}`,
    appointmentId: created.id,
    clientId: created.clientId,
  });

  res.status(201).json({
    ok: true,
    status: created.status,
    reference: created.id.slice(-6).toUpperCase(),
    whatsapp: contact.whatsapp,
  });
});
