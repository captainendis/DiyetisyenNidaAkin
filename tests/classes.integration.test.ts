// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Grup dersleri (Pilates) entegrasyon testi — geliştirme veritabanına karşı çalışır.
 * Kendi oluşturduğu kayıtları siler ve çalışma kuralını eski haline getirir.
 * Gereksinim: appointments.integration.test.ts ile aynı (seed + yönetici hesabı).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { expandWeeklySlots } from '../server/services/classes';
import { addDays, isoWeekday, todayStr } from '../shared/time';

const EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'nida@example.com';
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'GucluSifre2026';
const TAG_PHONE = '+905551110';

const app = createApp();
const agent = request.agent(app);
let csrf = '';
// Randevu testinden farklı bir gün (o test +14 gün kullanır)
const date = addDays(todayStr(), 22);
const weekday = isoWeekday(date);
let originalRule: Awaited<ReturnType<typeof prisma.availabilityRule.findUnique>>;
const clientIds: string[] = [];
let groupId = '';
const sessionIds: string[] = [];

const post = (url: string, body: unknown) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object);
const patch = (url: string, body: unknown) => agent.patch(url).set('X-CSRF-Token', csrf).send(body as object);
const put = (url: string, body: unknown) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object);
const del = (url: string) => agent.delete(url).set('X-CSRF-Token', csrf);

beforeAll(async () => {
  originalRule = await prisma.availabilityRule.findUnique({ where: { weekday } });
  const rule = { isWorking: true, startTime: '09:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', slotMinutes: 45, bufferMinutes: 15 };
  await prisma.availabilityRule.upsert({ where: { weekday }, create: { weekday, ...rule }, update: rule });
  for (let i = 0; i < 5; i++) {
    const c = await prisma.client.create({ data: { firstName: `Pilates${'ABCDE'[i]}`, lastName: 'Test', phone: `${TAG_PHONE}${i}` } });
    clientIds.push(c.id);
  }
  const login = await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(login.status).toBe(200);
  csrf = (await agent.get('/api/auth/me')).body.user.csrfToken;
});

afterAll(async () => {
  await prisma.classSession.deleteMany({ where: { OR: [{ id: { in: sessionIds } }, { groupId: groupId || '-' }, { attendees: { some: { clientId: { in: clientIds } } } }] } });
  if (groupId) await prisma.classGroup.deleteMany({ where: { id: groupId } });
  await prisma.appointment.deleteMany({ where: { contactPhone: { startsWith: TAG_PHONE } } });
  await prisma.client.deleteMany({ where: { phone: { startsWith: TAG_PHONE } } });
  if (originalRule) {
    const { id: _id, ...rest } = originalRule;
    await prisma.availabilityRule.update({ where: { weekday }, data: rest });
  } else {
    await prisma.availabilityRule.deleteMany({ where: { weekday } });
  }
  await prisma.$disconnect();
});

describe('haftalık tekrar hesaplama', () => {
  it('başlangıçtan itibaren N hafta içindeki gün/saatleri sıralı ve tekil üretir', () => {
    // 2026-11-16 Pazartesi
    const out = expandWeeklySlots('2026-11-16', 2, [
      { weekday: 4, time: '19:00' },
      { weekday: 2, time: '18:00' },
      { weekday: 2, time: '18:00' },
    ]);
    expect(out).toEqual([
      { date: '2026-11-17', time: '18:00' },
      { date: '2026-11-19', time: '19:00' },
      { date: '2026-11-24', time: '18:00' },
      { date: '2026-11-26', time: '19:00' },
    ]);
  });
});

describe('pilates grupları ve dersler', () => {
  it('grup kontenjanını aşan üye listesi reddedilir', async () => {
    const res = await post('/api/classes/groups', { name: 'Fazla Kalabalık', capacity: 3, memberIds: clientIds.slice(0, 4) });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fields.memberIds).toBeTruthy();
  });

  it('3 kişilik grup oluşturur ve tekrarlayan dersleri üyelerle birlikte açar', async () => {
    const g = await post('/api/classes/groups', { name: 'Test Pilates 10:00', capacity: 3, defaultDurationMinutes: 50, memberIds: clientIds.slice(0, 3) });
    expect(g.status).toBe(201);
    groupId = g.body.group.id;
    expect(g.body.group.members).toHaveLength(3);

    const rec = await post(`/api/classes/groups/${groupId}/recurring`, { slots: [{ weekday, time: '10:00' }], startDate: date, weeks: 2 });
    expect(rec.status).toBe(201);
    expect(rec.body.created).toBe(2);
    expect(rec.body.skipped).toEqual([]);

    const list = await agent.get('/api/classes/sessions').query({ from: date, to: addDays(date, 7), groupId });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    const first = list.body.items[0];
    sessionIds.push(...list.body.items.map((s: { id: string }) => s.id));
    expect(first.date).toBe(date);
    expect(first.time).toBe('10:00');
    expect(first.durationMinutes).toBe(50);
    expect(first.seatsTaken).toBe(3);
    expect(first.attendees.every((a: { isMember: boolean }) => a.isMember)).toBe(true);

    const groups = await agent.get('/api/classes/groups');
    const mine = groups.body.items.find((x: { id: string }) => x.id === groupId);
    expect(mine.upcomingCount).toBe(2);
  });

  it('ders saatine randevu verilemez; boş saatler listesinde de dolu görünür', async () => {
    const appt = await post('/api/appointments', { contactName: 'Pilates Çakışma', contactPhone: `${TAG_PHONE}9`, date, time: '10:30', meetingType: 'IN_PERSON', status: 'CONFIRMED' });
    expect(appt.status).toBe(409);
    expect(appt.body.error.code).toBe('CONFLICT');
    expect(appt.body.error.details.conflictingClassSessionId).toBe(sessionIds[0]);

    // Dinlenme süresi (15 dk) ders için de geçerli: 10:50 bitiş → 11:00 randevusu çakışır
    const tooClose = await post('/api/appointments', { contactName: 'Pilates Çakışma', contactPhone: `${TAG_PHONE}9`, date, time: '11:00', meetingType: 'IN_PERSON', status: 'CONFIRMED' });
    expect(tooClose.status).toBe(409);

    const slots = await agent.get('/api/appointments/slots').query({ date });
    const at10 = slots.body.slots.find((s: { time: string }) => s.time === '10:00');
    expect(at10.available).toBe(false);
  });

  it('dersler art arda olabilir ama örtüşemez', async () => {
    const overlap = await post('/api/classes/sessions', { title: 'Örtüşen ders', date, time: '10:30', clientIds: [clientIds[3]] });
    expect(overlap.status).toBe(409);

    const backToBack = await post('/api/classes/sessions', { title: 'Art arda ders', date, time: '10:50', durationMinutes: 50, capacity: 2, clientIds: [clientIds[3]] });
    expect(backToBack.status).toBe(201);
    sessionIds.push(backToBack.body.session.id);
    expect(backToBack.body.session.groupId).toBeNull();
    expect(backToBack.body.session.seatsTaken).toBe(1);
  });

  it('kontenjan doluyken eklenemez; haber veren kişinin yerine telafi danışanı eklenir', async () => {
    const sid = sessionIds[0];
    const full = await post(`/api/classes/sessions/${sid}/attendees`, { clientId: clientIds[4] });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('CLASS_FULL');

    const excuse = await patch(`/api/classes/sessions/${sid}/attendees/${clientIds[0]}`, { status: 'EXCUSED' });
    expect(excuse.status).toBe(200);
    expect(excuse.body.session.seatsTaken).toBe(2);

    const makeup = await post(`/api/classes/sessions/${sid}/attendees`, { clientId: clientIds[4] });
    expect(makeup.status).toBe(200);
    const guest = makeup.body.session.attendees.find((a: { clientId: string }) => a.clientId === clientIds[4]);
    expect(guest.isMember).toBe(false);
    expect(makeup.body.session.seatsTaken).toBe(3);

    // Haber veren kişi geri dönmek isterse kontenjan yine kontrol edilir
    const back = await patch(`/api/classes/sessions/${sid}/attendees/${clientIds[0]}`, { status: 'BOOKED' });
    expect(back.status).toBe(409);
  });

  it('gelecekteki derste "katıldı" işaretlenemez, ders "yapıldı" yapılamaz', async () => {
    const sid = sessionIds[0];
    const att = await patch(`/api/classes/sessions/${sid}/attendees/${clientIds[1]}`, { status: 'ATTENDED' });
    expect(att.status).toBe(409);
    const done = await post(`/api/classes/sessions/${sid}/status`, { status: 'COMPLETED' });
    expect(done.status).toBe(409);
    expect(done.body.error.code).toBe('NOT_STARTED');
  });

  it('ders yeni saate taşınır; iptal edilen ders saati boşaltır', async () => {
    const sid = sessionIds[1];
    const moved = await patch(`/api/classes/sessions/${sid}`, { time: '15:00' });
    expect(moved.status).toBe(200);
    expect(moved.body.session.time).toBe('15:00');

    const cancelled = await post(`/api/classes/sessions/${sid}/status`, { status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    const nextWeek = addDays(date, 7);
    const appt = await post('/api/appointments', { contactName: 'Pilates Boşalan', contactPhone: `${TAG_PHONE}8`, date: nextWeek, time: '15:00', meetingType: 'IN_PERSON', status: 'CONFIRMED' });
    expect(appt.status).toBe(201);

    // Saat artık dolu: iptal edilen ders yeniden planlanamaz
    const restore = await post(`/api/classes/sessions/${sid}/status`, { status: 'SCHEDULED' });
    expect(restore.status).toBe(409);
  });

  it('gruptan ayrılan üye gelecek derslerden çıkarılır, yeni üye eklenir', async () => {
    const res = await put(`/api/classes/groups/${groupId}/members`, { memberIds: [clientIds[1], clientIds[2], clientIds[3]] });
    expect(res.status).toBe(200);
    // Yalnızca ilk ders planlı (ikincisi iptal); ilk derste 0. danışan "haber verdi" idi → çıkarılır
    expect(res.body.sync.removed).toBe(1);
    // İlk ders telafi danışanıyla dolu (1, 2, 4) → 3. danışan sığmaz
    expect(res.body.sync.full).toBe(1);

    const s = await agent.get(`/api/classes/sessions/${sessionIds[0]}`);
    const ids = s.body.session.attendees.map((a: { clientId: string }) => a.clientId);
    expect(ids).not.toContain(clientIds[0]);
    expect(ids).toContain(clientIds[4]);
  });

  it('danışan özeti üyelik ve yaklaşan dersleri döner', async () => {
    const res = await agent.get(`/api/classes/clients/${clientIds[1]}`);
    expect(res.status).toBe(200);
    expect(res.body.groups.map((g: { id: string }) => g.id)).toContain(groupId);
    expect(res.body.upcoming[0].myStatus).toBe('BOOKED');
  });

  it('planlı dersi olan grup silinemez; pasife alınınca yeni ders açılamaz', async () => {
    const d = await del(`/api/classes/groups/${groupId}`);
    expect(d.status).toBe(409);
    expect(d.body.error.code).toBe('GROUP_HAS_UPCOMING');

    const off = await patch(`/api/classes/groups/${groupId}`, { isActive: false });
    expect(off.status).toBe(200);
    const rec = await post(`/api/classes/groups/${groupId}/recurring`, { slots: [{ weekday, time: '17:00' }], startDate: date, weeks: 1 });
    expect(rec.status).toBe(409);

    const cap = await patch(`/api/classes/groups/${groupId}`, { capacity: 2 });
    expect(cap.status).toBe(422);
  });

  it('asistan rolü olmayan kullanıcı olmadan da yetki kontrolü: oturumsuz istek reddedilir', async () => {
    const res = await request(app).get('/api/classes/groups');
    expect(res.status).toBe(401);
  });
});
