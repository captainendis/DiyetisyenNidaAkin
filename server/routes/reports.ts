/**
 * Raporlar — yalnızca randevu ve danışan sayıları. Finansal rapor yoktur
 * (ödeme takibi modülü olmadan gelir gösterilmez).
 */
import { Router } from 'express';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db';
import { badRequest, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { requirePermission } from '../auth/session';
import { reportQuerySchema } from '../../shared/schemas';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, TIME_ZONE, type AppointmentStatus, type MeetingType } from '../../shared/constants';
import { eachDay, endOfDayExclusive, startOfDay, toDateStr, toTimeStr } from '../../shared/time';

export const reportsRouter = Router();
reportsRouter.use(requirePermission('reports:read'));

function range(query: unknown) {
  const { from, to } = parse(reportQuerySchema, query);
  if (from > to) throw badRequest('Başlangıç tarihi bitişten sonra olamaz');
  const days = DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days;
  if (days > 366) throw badRequest('Tarih aralığı en fazla 1 yıl olabilir');
  return { from, to, start: startOfDay(from), end: endOfDayExclusive(to) };
}

interface Bucket { key: string; label: string; start: string; total: number; completed: number; cancelled: number; noShow: number; pending: number; confirmed: number }
const emptyBucket = (key: string, label: string, start: string): Bucket => ({ key, label, start, total: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0, confirmed: 0 });

function add(b: Bucket, status: AppointmentStatus) {
  b.total++;
  if (status === 'COMPLETED') b.completed++;
  else if (status === 'CANCELLED') b.cancelled++;
  else if (status === 'NO_SHOW') b.noShow++;
  else if (status === 'CONFIRMED') b.confirmed++;
  else b.pending++;
}

reportsRouter.get('/', async (req, res) => {
  const { from, to, start, end } = range(req.query);
  const [appts, untimed, newClients, completedInRange] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: start, lt: end } },
      select: { startsAt: true, status: true, meetingType: true, source: true, clientId: true },
    }),
    prisma.appointment.count({ where: { startsAt: null, createdAt: { gte: start, lt: end } } }),
    prisma.client.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.appointment.findMany({
      where: { status: 'COMPLETED', startsAt: { gte: start, lt: end }, clientId: { not: null } },
      select: { clientId: true },
      distinct: ['clientId'],
    }),
  ]);

  // Tekrar gelen: toplamda ≥2 tamamlanmış görüşmesi olan ve bunlardan en az biri aralıkta olan danışan
  const ids = completedInRange.map((c) => c.clientId!) as string[];
  const counts = ids.length
    ? await prisma.appointment.groupBy({ by: ['clientId'], where: { clientId: { in: ids }, status: 'COMPLETED', startsAt: { lt: end } }, _count: { _all: true } })
    : [];
  const returningClients = counts.filter((c) => c._count._all >= 2).length;

  const days = eachDay(from, to);
  const daily = new Map(days.map((d) => [d, emptyBucket(d, DateTime.fromISO(d, { zone: TIME_ZONE }).toFormat('d MMM'), d)]));
  const weekly = new Map<string, Bucket>();
  const monthly = new Map<string, Bucket>();
  for (const d of days) {
    const dt = DateTime.fromISO(d, { zone: TIME_ZONE });
    const wk = `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
    if (!weekly.has(wk)) {
      const ws = dt.startOf('week');
      weekly.set(wk, emptyBucket(wk, `${ws.toFormat('d MMM')} haftası`, ws.toISODate()!));
    }
    const mk = dt.toFormat('yyyy-MM');
    if (!monthly.has(mk)) monthly.set(mk, emptyBucket(mk, dt.toFormat('LLLL yyyy'), dt.startOf('month').toISODate()!));
  }

  const totals = { appointments: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0, confirmed: 0, untimedRequests: untimed, newClients, returningClients };
  const byMeetingType: Record<MeetingType, number> = { IN_PERSON: 0, ONLINE: 0 };
  const bySource: Record<'WEBSITE' | 'PANEL', number> = { WEBSITE: 0, PANEL: 0 };
  for (const a of appts) {
    const status = a.status as AppointmentStatus;
    const d = toDateStr(a.startsAt!);
    const dt = DateTime.fromISO(d, { zone: TIME_ZONE });
    const wk = `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
    for (const b of [daily.get(d), weekly.get(wk), monthly.get(dt.toFormat('yyyy-MM'))]) if (b) add(b, status);
    totals.appointments++;
    if (status === 'COMPLETED') totals.completed++;
    else if (status === 'CANCELLED') totals.cancelled++;
    else if (status === 'NO_SHOW') totals.noShow++;
    else if (status === 'CONFIRMED') totals.confirmed++;
    else totals.pending++;
    byMeetingType[a.meetingType as MeetingType]++;
    bySource[a.source as 'WEBSITE' | 'PANEL']++;
  }

  res.json({
    range: { from, to, days: days.length },
    totals,
    daily: [...daily.values()],
    weekly: [...weekly.values()],
    monthly: [...monthly.values()],
    byMeetingType,
    bySource,
  });
});

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? '' : String(v);
  // CSV/formül enjeksiyonuna karşı: =,+,-,@ ile başlayan hücreleri kaçır
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

reportsRouter.get('/export.csv', async (req, res) => {
  const { from, to, start, end } = range(req.query);
  const rows = await prisma.appointment.findMany({
    where: { startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: 'asc' },
    select: {
      startsAt: true, endsAt: true, status: true, meetingType: true, source: true, contactName: true,
      client: { select: { firstName: true, lastName: true } }, service: { select: { title: true } },
    },
  });
  const header = ['Tarih', 'Başlangıç', 'Bitiş', 'Durum', 'Görüşme türü', 'Hizmet', 'Danışan', 'Kaynak'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push(
      [
        toDateStr(r.startsAt!),
        toTimeStr(r.startsAt!),
        r.endsAt ? toTimeStr(r.endsAt) : '',
        APPOINTMENT_STATUS_LABEL[r.status as AppointmentStatus],
        MEETING_TYPE_LABEL[r.meetingType as MeetingType],
        r.service?.title ?? '',
        r.client ? `${r.client.firstName} ${r.client.lastName}` : r.contactName,
        r.source === 'WEBSITE' ? 'Web sitesi' : 'Panel',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  await audit(req, 'report.export', 'report', null, { from, to, rows: rows.length });
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="randevu-raporu-${from}_${to}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.send('﻿' + lines.join('\r\n'));
});
