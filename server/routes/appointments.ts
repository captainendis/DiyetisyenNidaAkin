// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Panel — randevu yönetimi */
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { HttpError, body, conflict, notFound, param, parse, query, router } from '../lib/http';
import { audit } from '../lib/audit';
import { authUser, requirePermission } from '../auth/session';
import { assertSlotAllowed, getDayPlans, getSlots, withAppointmentLock } from '../services/availability';
import {
  appointmentInclude,
  changeStatus,
  getAppointmentOr404,
  reschedule,
  resolveDuration,
  toDTO,
} from '../services/appointments';
import { notifyStaff } from '../services/notifications';
import {
  appointmentListQuerySchema,
  appointmentStatusChangeSchema,
  dateStr,
  panelAppointmentCreateSchema,
  panelAppointmentUpdateSchema,
} from '../../shared/schemas';
import { HARD_CONFLICT_STATUSES, SLOT_HOLDING_STATUSES, type AppointmentStatus } from '../../shared/constants';
import { addDays, endOfDayExclusive, isoWeekday, startOfDay } from '../../shared/time';

export const appointmentsRouter = router();
const canRead = requirePermission('appointments:read');
const canWrite = requirePermission('appointments:write');

// ───────────── Yardımcı uçlar (/:id'den önce tanımlanmalı) ─────────────

const slotsQuery = z.object({
  date: dateStr,
  duration: z.coerce.number().int().min(10).max(240).optional(),
  ignoreId: z.string().max(40).optional(),
});
appointmentsRouter.get('/slots', canRead, async (c) => {
  const q = parse(slotsQuery, query(c));
  const { plan, slots } = await getSlots(q.date, { durationMinutes: q.duration, ignoreAppointmentId: q.ignoreId });
  return c.json({ date: q.date, closedReason: plan.isWorking ? null : plan.closedReason, slotMinutes: plan.slotMinutes, slots });
});

const rangeQuery = z.object({ from: dateStr, to: dateStr }).refine((v) => v.from <= v.to && v.to <= addDays(v.from, 62), 'Geçersiz aralık');
appointmentsRouter.get('/day-plans', canRead, async (c) => {
  const q = parse(rangeQuery, query(c));
  const plans = await getDayPlans(q.from, q.to);
  return c.json({
    days: [...plans.values()].map((p) => ({
      date: p.date,
      isWorking: p.isWorking,
      closedReason: p.closedReason,
      windows: p.windows,
      slotMinutes: p.slotMinutes,
    })),
  });
});

// ───────────── Liste ─────────────

appointmentsRouter.get('/', canRead, async (c) => {
  const q = parse(appointmentListQuerySchema, query(c));
  const statuses = q.status ? (Array.isArray(q.status) ? q.status : [q.status]) : undefined;
  const and: Prisma.AppointmentWhereInput[] = [];

  if (statuses) and.push({ status: { in: statuses } });
  if (q.meetingType) and.push({ meetingType: q.meetingType });
  if (q.clientId) and.push({ clientId: q.clientId });
  if (q.from || q.to) {
    const range: Prisma.DateTimeNullableFilter = {};
    if (q.from) range.gte = startOfDay(q.from);
    if (q.to) range.lt = endOfDayExclusive(q.to);
    // Saatsiz "Yeni Talep"ler yalnızca açıkça filtrelendiğinde tarih aralığından bağımsız listelenir
    if (statuses?.includes('NEW_REQUEST')) and.push({ OR: [{ startsAt: range }, { startsAt: null }] });
    else and.push({ startsAt: range });
  }
  if (q.q) {
    const term = q.q.trim();
    const digits = term.replace(/\D/g, '');
    const or: Prisma.AppointmentWhereInput[] = [
      { contactName: { contains: term } },
      { contactEmail: { contains: term } },
      { client: { firstName: { contains: term } } },
      { client: { lastName: { contains: term } } },
    ];
    if (digits.length >= 3) or.push({ contactPhone: { contains: digits.replace(/^0/, '') } });
    and.push({ OR: or });
  }
  const where: Prisma.AppointmentWhereInput = and.length ? { AND: and } : {};
  const orderBy: Prisma.AppointmentOrderByWithRelationInput =
    q.sort === 'startsAt'
      ? { startsAt: { sort: 'asc', nulls: 'last' } }
      : q.sort === '-startsAt'
        ? { startsAt: { sort: 'desc', nulls: 'first' } }
        : q.sort === 'createdAt'
          ? { createdAt: 'asc' }
          : { createdAt: 'desc' };

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: [orderBy, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: appointmentInclude,
    }),
  ]);
  return c.json({ items: rows.map(toDTO), total, page: q.page, pageSize: q.pageSize });
});

// ───────────── Oluşturma ─────────────

appointmentsRouter.post('/', canWrite, async (c) => {
  const input = parse(panelAppointmentCreateSchema, await body(c));
  if (!input.clientId && (!input.contactName || !input.contactPhone)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Danışan seçin veya ad ve telefon girin', {
      fields: { ...(!input.contactName ? { contactName: 'Ad soyad gerekli' } : {}), ...(!input.contactPhone ? { contactPhone: 'Telefon gerekli' } : {}) },
    });
  }
  let newClient: { id: string; name: string } | null = null;

  const created = await withAppointmentLock(async (tx) => {
    let contact: { name: string; phone: string; email: string | null; clientId: string };
    if (input.clientId) {
      const c = await tx.client.findUnique({ where: { id: input.clientId } });
      if (!c) throw notFound('Danışan bulunamadı');
      contact = { name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone, email: c.email, clientId: c.id };
    } else {
      const parts = input.contactName!.trim().split(/\s+/);
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      const existing = await tx.client.findFirst({ where: { phone: input.contactPhone! }, select: { id: true } });
      let clientId = existing?.id;
      if (!clientId) {
        const c = await tx.client.create({
          data: {
            firstName,
            lastName,
            phone: input.contactPhone!,
            email: input.contactEmail ?? null,
            source: 'PANEL',
            preferredMeetingType: input.meetingType,
            firstVisitDate: input.date,
          },
        });
        clientId = c.id;
        newClient = { id: c.id, name: input.contactName!.trim() };
      }
      contact = { name: input.contactName!.trim(), phone: input.contactPhone!, email: input.contactEmail ?? null, clientId };
    }

    const duration = await resolveDuration(tx, { serviceId: input.serviceId, weekday: isoWeekday(input.date), explicit: input.durationMinutes });
    const times = await assertSlotAllowed(
      tx,
      { date: input.date, time: input.time, durationMinutes: duration },
      { statuses: input.status === 'CONFIRMED' ? HARD_CONFLICT_STATUSES : SLOT_HOLDING_STATUSES, enforceHours: !input.allowOutsideHours },
    );
    const a = await tx.appointment.create({
      data: {
        clientId: contact.clientId,
        serviceId: input.serviceId ?? null,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        ...times,
        meetingType: input.meetingType,
        status: input.status,
        source: 'PANEL',
        internalNote: input.internalNote ?? null,
        createdById: authUser(c).id,
      },
      include: appointmentInclude,
    });
    await tx.appointmentStatusHistory.create({
      data: { appointmentId: a.id, toStatus: input.status, note: input.allowOutsideHours ? 'Panelden özel randevu' : 'Panelden oluşturuldu', changedById: authUser(c).id },
    });
    await audit(c, 'appointment.created', 'appointment', a.id, { status: input.status, outsideHours: input.allowOutsideHours }, tx);
    return a;
  });

  if (newClient) {
    const c = newClient as { id: string; name: string };
    await notifyStaff('CLIENT_CREATED', { title: `Yeni danışan kaydı: ${c.name}`, body: 'Panelden randevu oluşturulurken eklendi.', clientId: c.id, appointmentId: created.id });
  }
  return c.json({ appointment: toDTO(created) }, 201);
});

// ───────────── Tekil ─────────────

appointmentsRouter.get('/:id', canRead, async (c) => {
  const a = await getAppointmentOr404(param(c));
  const history = await prisma.appointmentStatusHistory.findMany({
    where: { appointmentId: a.id },
    orderBy: { changedAt: 'desc' },
    include: { changedBy: { select: { firstName: true, lastName: true } } },
  });
  return c.json({
    appointment: {
      ...toDTO(a),
      statusHistory: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        previousStartsAt: h.previousStartsAt,
        newStartsAt: h.newStartsAt,
        changedAt: h.changedAt,
        changedBy: h.changedBy,
      })),
    },
  });
});

appointmentsRouter.patch('/:id', canWrite, async (c) => {
  const input = parse(panelAppointmentUpdateSchema, await body(c));
  const id = param(c);
  const extra: Prisma.AppointmentUpdateInput = {};
  if (input.meetingType !== undefined) extra.meetingType = input.meetingType;
  if (input.internalNote !== undefined) extra.internalNote = input.internalNote;
  if (input.serviceId !== undefined) extra.service = input.serviceId ? { connect: { id: input.serviceId } } : { disconnect: true };
  if (input.clientId !== undefined) extra.client = input.clientId ? { connect: { id: input.clientId } } : { disconnect: true };
  const row = await reschedule(c, id, {
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes,
    allowOutsideHours: input.allowOutsideHours,
    extra,
  });
  return c.json({ appointment: toDTO(row) });
});

appointmentsRouter.post('/:id/status', canWrite, async (c) => {
  const { status, note } = parse(appointmentStatusChangeSchema, await body(c));
  const row = await changeStatus(c, param(c), status as AppointmentStatus, note);
  return c.json({ appointment: toDTO(row) });
});

appointmentsRouter.delete('/:id', canWrite, async (c) => {
  const a = await prisma.appointment.findUnique({ where: { id: param(c) }, select: { id: true, status: true, startsAt: true } });
  if (!a) throw notFound('Randevu bulunamadı');
  if (a.status === 'COMPLETED') throw conflict('NOT_DELETABLE', 'Tamamlanmış randevular silinemez; kayıt geçmişi için saklanır.');
  await prisma.appointment.delete({ where: { id: a.id } });
  await audit(c, 'appointment.deleted', 'appointment', a.id, { status: a.status, past: a.startsAt ? a.startsAt < new Date() : null });
  return c.json({ ok: true });
});

