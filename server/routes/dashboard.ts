/**
 * Dashboard — tüm sayılar canlı veritabanından hesaplanır. Karşılaştırma dönemleri yanıtta adıyla döner.
 */
import { Router } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { prisma } from '../lib/db';
import { parse } from '../lib/http';
import { requirePermission } from '../auth/session';
import { appointmentInclude, toDTO } from '../services/appointments';
import { getSettings } from '../services/settings';
import { dateStr } from '../../shared/schemas';
import { TIME_ZONE, type AppointmentStatus } from '../../shared/constants';
import { addDays, eachDay, endOfDayExclusive, startOfDay, toDateStr, todayStr } from '../../shared/time';

export const dashboardRouter = Router();
dashboardRouter.use(requirePermission('dashboard:read'));

/** "Gerçekleşen/planlanan" görüşme: iptal edilmemiş, saati belli randevular */
const ACTIVE: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'];
const MEETING: AppointmentStatus[] = ['CONFIRMED', 'COMPLETED'];

function bucket(dates: (Date | null)[], days: string[]) {
  const m = new Map(days.map((d) => [d, 0]));
  for (const d of dates) {
    if (!d) continue;
    const k = toDateStr(d);
    if (m.has(k)) m.set(k, m.get(k)! + 1);
  }
  return days.map((date) => ({ date, value: m.get(date)! }));
}

dashboardRouter.get('/stats', async (_req, res) => {
  const today = todayStr();
  const days7 = eachDay(addDays(today, -6), today);
  const from7 = startOfDay(days7[0]);
  const to7 = endOfDayExclusive(today);
  const now = DateTime.now().setZone(TIME_ZONE);
  const monthStart = now.startOf('month');
  const nextMonth = monthStart.plus({ months: 1 });
  const prevMonth = monthStart.minus({ months: 1 });
  const lastWeekSameDay = addDays(today, -7);

  const [
    todayCount, lastWeekCount, active7,
    pendingCount, requests7, requestsPrev7,
    clientCount, newClients7, newClientsMonth, newClientsPrevMonth,
    monthMeetings, prevMonthMeetings, meetings7,
  ] = await Promise.all([
    prisma.appointment.count({ where: { status: { in: ACTIVE }, startsAt: { gte: startOfDay(today), lt: to7 } } }),
    prisma.appointment.count({ where: { status: { in: ACTIVE }, startsAt: { gte: startOfDay(lastWeekSameDay), lt: endOfDayExclusive(lastWeekSameDay) } } }),
    prisma.appointment.findMany({ where: { status: { in: ACTIVE }, startsAt: { gte: from7, lt: to7 } }, select: { startsAt: true } }),
    prisma.appointment.count({ where: { status: { in: ['PENDING', 'NEW_REQUEST'] } } }),
    prisma.appointment.findMany({ where: { source: 'WEBSITE', createdAt: { gte: from7, lt: to7 } }, select: { createdAt: true } }),
    prisma.appointment.count({ where: { source: 'WEBSITE', createdAt: { gte: startOfDay(addDays(today, -13)), lt: from7 } } }),
    prisma.client.count({ where: { status: { in: ['ACTIVE', 'PASSIVE'] } } }),
    prisma.client.findMany({ where: { createdAt: { gte: from7, lt: to7 } }, select: { createdAt: true } }),
    prisma.client.count({ where: { createdAt: { gte: monthStart.toJSDate(), lt: nextMonth.toJSDate() } } }),
    prisma.client.count({ where: { createdAt: { gte: prevMonth.toJSDate(), lt: monthStart.toJSDate() } } }),
    prisma.appointment.count({ where: { status: { in: MEETING }, startsAt: { gte: monthStart.toJSDate(), lt: nextMonth.toJSDate() } } }),
    prisma.appointment.count({ where: { status: { in: MEETING }, startsAt: { gte: prevMonth.toJSDate(), lt: monthStart.toJSDate() } } }),
    prisma.appointment.findMany({ where: { status: { in: MEETING }, startsAt: { gte: from7, lt: to7 } }, select: { startsAt: true } }),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    seriesLabel: 'Son 7 gün',
    cards: {
      today: {
        value: todayCount,
        comparison: { value: lastWeekCount, label: 'geçen hafta aynı gün' },
        series: bucket(active7.map((r) => r.startsAt), days7),
      },
      pending: {
        value: pendingCount,
        comparison: { value: requestsPrev7, current: requests7.length, label: 'son 7 günde web sitesinden gelen talep, önceki 7 güne göre' },
        series: bucket(requests7.map((r) => r.createdAt), days7),
      },
      clients: {
        value: clientCount,
        comparison: { value: newClientsPrevMonth, current: newClientsMonth, label: 'bu ay eklenen danışan, geçen aya göre' },
        series: bucket(newClients7.map((r) => r.createdAt), days7),
      },
      month: {
        value: monthMeetings,
        comparison: { value: prevMonthMeetings, label: `${prevMonth.setLocale('tr').toFormat('LLLL')} ayı toplamı` },
        series: bucket(meetings7.map((r) => r.startsAt), days7),
      },
    },
  });
});

const agendaQuery = z.object({ date: dateStr.optional() });

dashboardRouter.get('/agenda', async (req, res) => {
  const q = parse(agendaQuery, req.query);
  const date = q.date ?? todayStr();
  const [items, pendingRequests, pendingTotal] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: startOfDay(date), lt: endOfDayExclusive(date) } },
      orderBy: { startsAt: 'asc' },
      include: appointmentInclude,
    }),
    prisma.appointment.findMany({
      where: { status: { in: ['PENDING', 'NEW_REQUEST'] } },
      orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 6,
      include: appointmentInclude,
    }),
    prisma.appointment.count({ where: { status: { in: ['PENDING', 'NEW_REQUEST'] } } }),
  ]);
  res.json({ date, items: items.map(toDTO), pendingRequests: pendingRequests.map(toDTO), pendingTotal });
});

dashboardRouter.get('/weekly', async (_req, res) => {
  const today = todayStr();
  const days = eachDay(addDays(today, -6), today);
  const rows = await prisma.appointment.findMany({
    where: { startsAt: { gte: startOfDay(days[0]), lt: endOfDayExclusive(today) } },
    select: { startsAt: true, status: true },
  });
  const map = new Map(days.map((d) => [d, { date: d, completed: 0, cancelled: 0, open: 0 }]));
  for (const r of rows) {
    const d = map.get(toDateStr(r.startsAt!));
    if (!d) continue;
    if (r.status === 'COMPLETED') d.completed++;
    else if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') d.cancelled++;
    else if (r.status === 'PENDING' || r.status === 'CONFIRMED') d.open++;
  }
  res.json({
    days: [...map.values()],
    definitions: {
      completed: 'Tamamlandı olarak işaretlenen',
      cancelled: 'İptal edilen veya danışanın gelmediği',
      open: 'Henüz sonuçlandırılmamış (onaylı veya onay bekleyen)',
    },
  });
});

/**
 * Kurulum kontrol listesi — sitenin yayına hazır olması için panelden doldurulması gerekenler.
 * Her madde gerçek veriden hesaplanır; tamamlandıkça otomatik işaretlenir.
 */
dashboardRouter.get('/setup', async (_req, res) => {
  const s = await getSettings(['contact', 'social', 'media', 'about', 'kvkk', 'business']);
  const [workingDays, services, publishedPosts] = await Promise.all([
    prisma.availabilityRule.count({ where: { isWorking: true } }),
    prisma.service.findMany({ select: { createdAt: true, updatedAt: true } }),
    prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
  ]);
  const servicesReviewed = services.length > 0 && services.every((x) => x.updatedAt.getTime() - x.createdAt.getTime() > 1000);
  const items = [
    { key: 'phone', group: 'İletişim', label: 'Telefon numarası', done: !!s.contact.phone, href: '/panel/icerikler?sekme=iletisim' },
    { key: 'whatsapp', group: 'İletişim', label: 'WhatsApp numarası', hint: 'Randevu formunda “WhatsApp’tan yazın” seçeneğini açar', done: !!s.contact.whatsapp, href: '/panel/icerikler?sekme=iletisim' },
    { key: 'email', group: 'İletişim', label: 'E-posta adresi', done: !!s.contact.email, href: '/panel/icerikler?sekme=iletisim' },
    { key: 'instagram', group: 'İletişim', label: 'Instagram hesabı', done: !!s.social.instagram, href: '/panel/icerikler?sekme=iletisim' },
    { key: 'hours', group: 'Randevu', label: 'Çalışma saatleri', hint: 'Girilene kadar web sitesi yalnızca “beni arayın” talebi alır', done: workingDays > 0, href: '/panel/ayarlar/takvim' },
    { key: 'portrait', group: 'Görseller', label: 'Portre fotoğrafı', done: !!s.media.portrait, href: '/panel/icerikler?sekme=gorseller' },
    { key: 'venue', group: 'Görseller', label: 'Görüşme alanı (üst kat) fotoğrafı', done: !!s.media.venue, href: '/panel/icerikler?sekme=gorseller' },
    { key: 'credentials', group: 'Hakkımda', label: 'Eğitim ve sertifika bilgileri', done: s.about.credentials.length > 0, href: '/panel/icerikler?sekme=hakkimda' },
    { key: 'services', group: 'Hizmetler', label: 'Hizmet metinleri gözden geçirildi', hint: 'Her hizmeti açıp doğrulayın ve kaydedin', done: servicesReviewed, href: '/panel/hizmetler' },
    { key: 'blog', group: 'İçerik', label: 'İlk blog yazısı yayında', done: publishedPosts > 0, href: '/panel/icerikler?sekme=blog' },
    { key: 'legalName', group: 'KVKK', label: 'Veri sorumlusu (resmî unvan)', done: !!s.business.legalName, href: '/panel/ayarlar?sekme=isletme' },
    { key: 'legal', group: 'KVKK', label: 'Yasal metinler hukuk uzmanınca incelendi', done: s.kvkk.legalReviewCompleted, href: '/panel/ayarlar?sekme=kvkk' },
  ];
  res.json({ items, done: items.filter((i) => i.done).length, total: items.length });
});
