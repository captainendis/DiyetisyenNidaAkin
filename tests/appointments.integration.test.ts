/**
 * Randevu çakışma entegrasyon testi — geliştirme veritabanına karşı çalışır.
 * Test kendi oluşturduğu kayıtları siler ve çalışma kurallarını eski haline getirir.
 * Gereksinim: `npm run db:seed` ve bir yönetici hesabı (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 * ortam değişkenleri; varsayılan geliştirme hesabı nida@example.com).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { addDays, isoWeekday, todayStr } from '../shared/time';

const EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'nida@example.com';
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'GucluSifre2026';
const TAG_PHONE = '+905550000';

const app = createApp();
const agent = request.agent(app);
let csrf = '';
const date = addDays(todayStr(), 14);
const weekday = isoWeekday(date);
let originalRule: Awaited<ReturnType<typeof prisma.availabilityRule.findUnique>>;
const createdIds: string[] = [];

const post = (url: string, body: unknown) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object);

beforeAll(async () => {
  originalRule = await prisma.availabilityRule.findUnique({ where: { weekday } });
  await prisma.availabilityRule.upsert({
    where: { weekday },
    create: { weekday, isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotMinutes: 45, bufferMinutes: 15 },
    update: { isWorking: true, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotMinutes: 45, bufferMinutes: 15 },
  });
  const login = await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(login.status).toBe(200);
  const me = await agent.get('/api/auth/me');
  csrf = me.body.user.csrfToken;
});

afterAll(async () => {
  await prisma.appointment.deleteMany({ where: { OR: [{ id: { in: createdIds } }, { contactPhone: { startsWith: TAG_PHONE } }] } });
  await prisma.client.deleteMany({ where: { phone: { startsWith: TAG_PHONE } } });
  if (originalRule) {
    const { id: _id, ...rest } = originalRule;
    await prisma.availabilityRule.update({ where: { weekday }, data: rest });
  }
  await prisma.$disconnect();
});

const panelBody = (time: string, n: number, status = 'CONFIRMED') => ({
  contactName: `Test Danışan ${'ABCDEFGHIJ'[n]}`,
  contactPhone: `${TAG_PHONE}${String(n).padStart(3, '0')}`,
  date,
  time,
  meetingType: 'IN_PERSON',
  status,
});

describe('randevu çakışma kontrolü', () => {
  it('CSRF başlığı olmadan durum değiştiren istek reddedilir', async () => {
    const res = await agent.post('/api/appointments').send(panelBody('09:00', 0));
    expect(res.status).toBe(403);
  });

  it('onaylı randevu oluşturur, çakışan ikinciyi 409 ile reddeder', async () => {
    const first = await post('/api/appointments', panelBody('09:00', 1));
    expect(first.status).toBe(201);
    createdIds.push(first.body.appointment.id);
    expect(first.body.appointment.date).toBe(date);
    expect(first.body.appointment.time).toBe('09:00');

    const overlap = await post('/api/appointments', panelBody('09:30', 2));
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('CONFLICT');

    // Dinlenme süresi (15 dk) içinde başlayan randevu da çakışmadır
    const buffer = await post('/api/appointments', panelBody('09:50', 3));
    expect(buffer.status).toBe(409);
  });

  it('çalışma saatleri ve öğle arası dışını reddeder', async () => {
    const lunch = await post('/api/appointments', panelBody('12:15', 4));
    expect(lunch.status).toBe(409);
    expect(lunch.body.error.code).toBe('OUTSIDE_HOURS');
  });

  it('eşzamanlı isteklerden yalnızca biri başarılı olur', async () => {
    const results = await Promise.all([5, 6, 7, 8].map((n) => post('/api/appointments', panelBody('15:00', n))));
    const ok = results.filter((r) => r.status === 201);
    ok.forEach((r) => createdIds.push(r.body.appointment.id));
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
  });

  it('web sitesi talebi dolu saate düşemez; kişisel bilgi sızdırmaz', async () => {
    const res = await request(app)
      .post('/api/public/appointments')
      .send({ fullName: 'Web Ziyaretçi', phone: '0555 000 0099', email: 'web@example.com', meetingType: 'IN_PERSON', mode: 'slot', date, time: '15:00', kvkkNotice: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
    expect(JSON.stringify(res.body)).not.toContain('conflictingAppointmentId');
  });

  it('bekleyen randevuyu çakışan saate onaylamak 409 döner; saat değişikliği de kontrol edilir', async () => {
    const pending = await post('/api/appointments', { ...panelBody('16:00', 9, 'PENDING') });
    expect(pending.status).toBe(201);
    const id = pending.body.appointment.id;
    createdIds.push(id);

    // Onaylı 15:00 randevusunun üstüne kaydırma reddedilir
    const move = await agent.patch(`/api/appointments/${id}`).set('X-CSRF-Token', csrf).send({ time: '15:15' });
    expect(move.status).toBe(409);

    const confirm = await post(`/api/appointments/${id}/status`, { status: 'CONFIRMED' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.appointment.status).toBe('CONFIRMED');

    const detail = await agent.get(`/api/appointments/${id}`);
    expect(detail.body.appointment.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toContain('CONFIRMED');
  });

  it('geçersiz durum geçişi reddedilir', async () => {
    const id = createdIds[0];
    const res = await post(`/api/appointments/${id}/status`, { status: 'NEW_REQUEST' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});
