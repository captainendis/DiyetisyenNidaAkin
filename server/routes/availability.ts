// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Çalışma takvimi: haftalık kurallar ve tarihe özel istisnalar */
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, body, notFound, param, parse, query, router } from '../lib/http';
import { audit } from '../lib/audit';
import { requirePermission } from '../auth/session';
import { availabilityRulesSchema, blockedDateSchema, dateStr } from '../../shared/schemas';
import { addDays, eachDay, todayStr, toDateStr, toTimeStr, minutesOf } from '../../shared/time';
import { getDayPlans } from '../services/availability';

export const availabilityRouter = router();

/** Kural değişikliği sonrası çalışma saatleri dışında kalan gelecekteki onaylı randevular */
async function findAffectedAppointments(from?: string, to?: string) {
  const start = from ?? todayStr();
  const end = to ?? addDays(start, 365);
  const appts = await prisma.appointment.findMany({
    where: { status: 'CONFIRMED', startsAt: { gte: new Date() } },
    select: { id: true, startsAt: true, endsAt: true, contactName: true },
    orderBy: { startsAt: 'asc' },
    take: 500,
  });
  const relevant = appts.filter((a) => {
    const d = toDateStr(a.startsAt!);
    return d >= start && d <= end;
  });
  if (!relevant.length) return [];
  const dates = relevant.map((a) => toDateStr(a.startsAt!)).sort();
  const plans = await getDayPlans(dates[0], dates[dates.length - 1]);
  return relevant
    .filter((a) => {
      const date = toDateStr(a.startsAt!);
      const plan = plans.get(date);
      const s = minutesOf(toTimeStr(a.startsAt!));
      const e = s + Math.round((a.endsAt!.getTime() - a.startsAt!.getTime()) / 60_000);
      return !plan?.isWorking || !plan.windows.some((w) => s >= w.start && e <= w.end);
    })
    .map((a) => ({ appointmentId: a.id, date: toDateStr(a.startsAt!), time: toTimeStr(a.startsAt!), contactName: a.contactName }));
}

availabilityRouter.get('/rules', requirePermission('appointments:read'), async (c) => {
  const rows = await prisma.availabilityRule.findMany({ orderBy: { weekday: 'asc' } });
  const rules = [1, 2, 3, 4, 5, 6, 7].map(
    (w) =>
      rows.find((r) => r.weekday === w) ?? {
        id: null, weekday: w, isWorking: false, startTime: null, endTime: null, breakStart: null, breakEnd: null, slotMinutes: 45, bufferMinutes: 15,
      },
  );
  return c.json({ rules });
});

availabilityRouter.put('/rules', requirePermission('availability:write'), async (c) => {
  const { rules } = parse(availabilityRulesSchema, await body(c));
  const weekdays = new Set(rules.map((r) => r.weekday));
  if (weekdays.size !== 7) throw badRequest('Her gün için tek bir kural gönderilmeli');
  await prisma.$transaction(
    rules.map((r) => {
      const data = r.isWorking
        ? r
        : { ...r, startTime: r.startTime ?? null, endTime: r.endTime ?? null, breakStart: r.breakStart ?? null, breakEnd: r.breakEnd ?? null };
      return prisma.availabilityRule.upsert({ where: { weekday: r.weekday }, create: data, update: data });
    }),
  );
  await audit(c, 'availability.rules_updated', 'availability_rule', null, {
    workingDays: rules.filter((r) => r.isWorking).map((r) => r.weekday),
  });
  const saved = await prisma.availabilityRule.findMany({ orderBy: { weekday: 'asc' } });
  return c.json({ rules: saved, warnings: await findAffectedAppointments() });
});

const rangeQuery = z.object({ from: dateStr.optional(), to: dateStr.optional() });

availabilityRouter.get('/blocked-dates', requirePermission('appointments:read'), async (c) => {
  const q = parse(rangeQuery, query(c));
  const items = await prisma.blockedDate.findMany({
    where: { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return c.json({ items });
});

availabilityRouter.post('/blocked-dates', requirePermission('availability:write'), async (c) => {
  const b = parse(blockedDateSchema, await body(c));
  const days = b.endDate ? eachDay(b.date, b.endDate) : [b.date];
  if (days.length > 120) throw badRequest('Tek seferde en fazla 120 gün eklenebilir');
  const full = b.kind === 'FULL_DAY';
  const created = await prisma.$transaction(
    days.map((date) =>
      prisma.blockedDate.create({
        data: {
          date,
          kind: b.kind,
          reason: b.reason,
          label: b.label || null,
          startTime: full ? null : b.startTime!,
          endTime: full ? null : b.endTime!,
        },
      }),
    ),
  );
  await audit(c, 'availability.blocked_date_created', 'blocked_date', created[0]?.id, { from: b.date, to: b.endDate ?? b.date, kind: b.kind });
  return c.json({ items: created, warnings: await findAffectedAppointments(b.date, b.endDate ?? b.date) }, 201);
});

availabilityRouter.delete('/blocked-dates/:id', requirePermission('availability:write'), async (c) => {
  const existing = await prisma.blockedDate.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound();
  await prisma.blockedDate.delete({ where: { id: existing.id } });
  await audit(c, 'availability.blocked_date_deleted', 'blocked_date', existing.id, { date: existing.date });
  return c.json({ ok: true });
});
