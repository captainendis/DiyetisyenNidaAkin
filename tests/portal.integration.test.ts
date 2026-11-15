// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı (Hesabım) entegrasyon testi — güvenlik sınırlarını uçtan uca doğrular:
 *  - Hesabı yalnızca portal:manage (yönetici) açar; diyetisyen rolü açamaz
 *  - Etkinleştirme bağlantısı tek kullanımlık; şifre politikası uygulanır
 *  - Danışan yalnızca kendi kayıtlarını görür; klinik notlar, ölçüm notları ve gizli dosyalar hiç dönmez
 *  - Danışan oturumu personel uçlarına, personel oturumu danışan uçlarına erişemez; CSRF zorunlu
 *  - Hesap kapatılınca açık oturum düşer
 * Kendi personel kullanıcılarını ve danışanlarını oluşturur, sonunda siler. Roller seed ile oluşturulmuş olmalı.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { encryptJson, encryptString, hashPassword } from '../server/lib/crypto';
import { samplePlanTemplate } from '../shared/plan';

const app = createApp();
const stamp = Date.now().toString(36);
const ADMIN = { email: `portal-admin-${stamp}@example.com`, password: 'YoneticiSifre2026' };
const DIET = { email: `portal-diet-${stamp}@example.com`, password: 'DiyetisyenSifre2026' };
const CLIENT_EMAIL = `danisan-${stamp}@example.com`;
const CLIENT_PASSWORD = 'DanisanSifre2026';
const SECRET_NOTE = `GIZLI-KLINIK-NOT-${stamp}`;
const SECRET_MEASURE_NOTE = `GIZLI-OLCUM-NOTU-${stamp}`;

const staff = request.agent(app);
const diet = request.agent(app);
const portal = request.agent(app);
let staffCsrf = '';
let dietCsrf = '';
let portalCsrf = '';
const userIds: string[] = [];
let clientA = '';
let clientB = '';
let planA = '';
let planB = '';
let activationToken = '';

async function staffUser(roleKey: 'ADMIN' | 'DIETITIAN', creds: { email: string; password: string }) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const u = await prisma.user.create({
    data: { email: creds.email, firstName: 'Test', lastName: roleKey, passwordHash: await hashPassword(creds.password), roleId: role.id },
  });
  userIds.push(u.id);
}

beforeAll(async () => {
  await staffUser('ADMIN', ADMIN);
  await staffUser('DIETITIAN', DIET);
  expect((await staff.post('/api/auth/login').send(ADMIN)).status).toBe(200);
  staffCsrf = (await staff.get('/api/auth/me')).body.user.csrfToken;
  expect((await diet.post('/api/auth/login').send(DIET)).status).toBe(200);
  dietCsrf = (await diet.get('/api/auth/me')).body.user.csrfToken;

  const consent = { healthConsentAt: new Date(), kvkkNoticeAt: new Date() };
  const a = await prisma.client.create({ data: { firstName: 'Ayşe', lastName: `Portal${stamp}`, phone: `+90555${String(Date.now()).slice(-7)}`, email: CLIENT_EMAIL, ...consent } });
  const b = await prisma.client.create({ data: { firstName: 'Başka', lastName: `Danisan${stamp}`, phone: `+90544${String(Date.now()).slice(-7)}`, ...consent } });
  clientA = a.id;
  clientB = b.id;
  planA = (await prisma.nutritionPlan.create({ data: { clientId: a.id, name: '1. ay, 1. liste', dataEnc: encryptJson({ ...samplePlanTemplate(), title: 'Ayşe’nin beslenme planı' }) } })).id;
  planB = (await prisma.nutritionPlan.create({ data: { clientId: b.id, name: 'B listesi', dataEnc: encryptJson(samplePlanTemplate()) } })).id;
  await prisma.consultationNote.create({ data: { clientId: a.id, contentEnc: encryptString(SECRET_NOTE) } });
  await prisma.measurement.create({ data: { clientId: a.id, measuredOn: '2026-10-24', dataEnc: encryptJson({ weightKg: 82.4, targetWeightKg: 75, note: SECRET_MEASURE_NOTE }) } });
  await prisma.measurement.create({ data: { clientId: a.id, measuredOn: '2026-11-08', dataEnc: encryptJson({ weightKg: 80.9 }) } });
  await prisma.appointment.create({
    data: { clientId: a.id, contactName: 'Ayşe', contactPhone: a.phone, startsAt: new Date(Date.now() + 7 * 864e5), endsAt: new Date(Date.now() + 7 * 864e5 + 45 * 60e3), status: 'CONFIRMED', internalNote: 'dahili' },
  });
});

afterAll(async () => {
  await prisma.appointment.deleteMany({ where: { clientId: { in: [clientA, clientB] } } });
  await prisma.client.deleteMany({ where: { id: { in: [clientA, clientB] } } }); // hesap, oturum, mesaj, plan cascade
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('hesap açma (panel)', () => {
  it('diyetisyen rolü hesap açamaz (yalnızca yönetici)', async () => {
    const res = await diet.post(`/api/clients/${clientA}/account`).set('X-CSRF-Token', dietCsrf).send({ email: CLIENT_EMAIL });
    expect(res.status).toBe(403);
  });

  it('yönetici hesap açar; tek kullanımlık etkinleştirme bağlantısı döner', async () => {
    const res = await staff.post(`/api/clients/${clientA}/account`).set('X-CSRF-Token', staffCsrf).send({ email: CLIENT_EMAIL });
    expect(res.status).toBe(201);
    expect(res.body.account).toMatchObject({ email: CLIENT_EMAIL, activated: false, isActive: true });
    expect(res.body.link.purpose).toBe('ACTIVATE');
    activationToken = new URL(res.body.link.link).searchParams.get('token')!;
    expect(activationToken.length).toBeGreaterThan(20);
    // Bağlantı DB'de düz metin tutulmaz
    expect(await prisma.clientAccountToken.count({ where: { tokenHash: activationToken } })).toBe(0);
  });

  it('aynı e-posta ikinci bir hesapta kullanılamaz', async () => {
    const res = await staff.post(`/api/clients/${clientB}/account`).set('X-CSRF-Token', staffCsrf).send({ email: CLIENT_EMAIL });
    expect(res.status).toBe(409);
  });

  it('etkinleştirilmemiş hesapla giriş yapılamaz', async () => {
    const res = await request(app).post('/api/portal/auth/login').send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('etkinleştirme', () => {
  it('bağlantı doğrulanır; zayıf şifre reddedilir', async () => {
    const info = await request(app).get('/api/portal/auth/token').query({ token: activationToken });
    expect(info.status).toBe(200);
    expect(info.body).toMatchObject({ purpose: 'ACTIVATE', firstName: 'Ayşe', email: CLIENT_EMAIL });
    const weak = await request(app).post('/api/portal/auth/set-password').send({ token: activationToken, password: 'kisa' });
    expect(weak.status).toBe(422);
  });

  it('şifre belirlenir ve oturum açılır; bağlantı ikinci kez kullanılamaz', async () => {
    const res = await portal.post('/api/portal/auth/set-password').send({ token: activationToken, password: CLIENT_PASSWORD });
    expect(res.status).toBe(200);
    const me = await portal.get('/api/portal/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.me).toMatchObject({ firstName: 'Ayşe', email: CLIENT_EMAIL });
    portalCsrf = me.body.me.csrfToken;
    const again = await request(app).post('/api/portal/auth/set-password').send({ token: activationToken, password: 'BaskaSifre2026' });
    expect(again.status).toBe(400);
  });
});

describe('danışanın gördükleri', () => {
  it('yalnızca kendi listelerini görür; başkasının listesi 404', async () => {
    const list = await portal.get('/api/portal/plans');
    expect(list.status).toBe(200);
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([planA]);
    expect((await portal.get(`/api/portal/plans/${planA}`)).body.plan.data.title).toBe('Ayşe’nin beslenme planı');
    expect((await portal.get(`/api/portal/plans/${planB}`)).status).toBe(404);
    expect((await portal.get(`/api/portal/plans/${planB}/print`)).status).toBe(404);
  });

  it('klinik not ve ölçüm notu hiçbir uçta dönmez', async () => {
    const bodies = await Promise.all(['/overview', '/plans', '/measurements', '/messages', '/appointments', '/files', '/recipes'].map((p) => portal.get(`/api/portal${p}`)));
    for (const r of bodies) {
      expect(r.status).toBe(200);
      const text = JSON.stringify(r.body);
      expect(text).not.toContain(SECRET_NOTE);
      expect(text).not.toContain(SECRET_MEASURE_NOTE);
      expect(text).not.toContain('dahili');
    }
    const m = (await portal.get('/api/portal/measurements')).body.items;
    expect(m).toHaveLength(2);
    expect(m[0]).not.toHaveProperty('note');
    const ov = (await portal.get('/api/portal/overview')).body;
    expect(ov.weight).toMatchObject({ current: 80.9, first: 82.4, target: 75 });
    expect(ov.nextAppointment.status).toBe('CONFIRMED');
  });

  it('personelin yazdığı mesajı görür', async () => {
    const res = await staff.post(`/api/clients/${clientA}/messages`).set('X-CSRF-Token', staffCsrf).send({ content: 'Akşam ekmeği 1 dilim.' });
    expect(res.status).toBe(201);
    const msgs = (await portal.get('/api/portal/messages')).body.items;
    expect(msgs.map((x: { content: string }) => x.content)).toEqual(['Akşam ekmeği 1 dilim.']);
  });

  it('gizlenen dosya listelenmez ve indirilemez', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const up = await staff.post(`/api/clients/${clientA}/files`).set('X-CSRF-Token', staffCsrf).attach('file', png, 'tahlil.png');
    expect(up.status).toBe(201);
    const fileId = up.body.file.id;
    expect((await portal.get('/api/portal/files')).body.items.map((f: { id: string }) => f.id)).toContain(fileId);
    expect((await portal.get(`/api/portal/files/${fileId}/download`)).status).toBe(200);

    const hide = await staff.patch(`/api/clients/${clientA}/files/${fileId}/visibility`).set('X-CSRF-Token', staffCsrf).send({ visibleToClient: false });
    expect(hide.status).toBe(200);
    expect((await portal.get('/api/portal/files')).body.items).toHaveLength(0);
    expect((await portal.get(`/api/portal/files/${fileId}/download`)).status).toBe(404);
  });

  it('pilates derslerinde yalnızca kendi katılımını görür; diğer katılımcılar dönmez', async () => {
    const start = new Date(Date.now() + 9 * 864e5);
    const session = await prisma.classSession.create({
      data: {
        title: 'Portal Pilates',
        startsAt: start,
        endsAt: new Date(start.getTime() + 50 * 60e3),
        capacity: 3,
        attendees: { create: [{ clientId: clientA }, { clientId: clientB, status: 'EXCUSED' }] },
      },
    });
    try {
      const res = await portal.get('/api/portal/classes');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([expect.objectContaining({ id: session.id, title: 'Portal Pilates', status: 'SCHEDULED', myStatus: 'BOOKED' })]);
      expect(JSON.stringify(res.body)).not.toContain(clientB);
      expect(JSON.stringify(res.body)).not.toContain('Başka');

      const pil = await portal.get('/api/portal/pilates');
      expect(pil.status).toBe(200);
      expect(pil.body.upcoming).toEqual([expect.objectContaining({ id: session.id, myStatus: 'BOOKED' })]);
      expect(JSON.stringify(pil.body)).not.toContain(clientB);

      const me = await portal.get('/api/portal/auth/me');
      expect(me.body.me.programs).toEqual({ nutrition: true, pilates: true });
    } finally {
      await prisma.classSession.delete({ where: { id: session.id } });
    }
  });
});

describe('pilates talebi (danışan hesabı)', () => {
  it('talep Randevular\'a saatsiz pilates talebi olarak düşer; ders türü zorunlu', async () => {
    const bad = await portal.post('/api/portal/pilates/requests').set('X-CSRF-Token', portalCsrf).send({ preferredDays: [2] });
    expect(bad.status).toBe(422);
    const res = await portal.post('/api/portal/pilates/requests').set('X-CSRF-Token', portalCsrf).send({ pilatesFormat: 'PRIVATE', preferredDays: [4, 2], preferredDayparts: ['EVENING'], message: 'Telafi' });
    expect(res.status).toBe(201);
    const a = await prisma.appointment.findFirstOrThrow({ where: { clientId: clientA, kind: 'PILATES' }, orderBy: { createdAt: 'desc' } });
    expect(a).toMatchObject({ status: 'NEW_REQUEST', pilatesFormat: 'PRIVATE', preferredDays: '2,4', preferredDayparts: 'EVENING', startsAt: null, clientMessage: 'Telafi' });
    const pil = await portal.get('/api/portal/pilates');
    expect(pil.body.requests).toEqual([expect.objectContaining({ id: a.id, pilatesFormat: 'PRIVATE', preferredDays: [2, 4] })]);

    const reqs = await portal.get('/api/portal/requests');
    expect(reqs.status).toBe(200);
    expect(reqs.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: a.id, kind: 'PILATES', status: 'NEW_REQUEST' })]));
  });

  it('pilates boş yerleri yalnızca sayı döner; katılımcı bilgisi dönmez', async () => {
    const start = new Date(Date.now() + 5 * 864e5);
    const session = await prisma.classSession.create({
      data: { title: 'Bos Yer Testi', startsAt: start, endsAt: new Date(start.getTime() + 50 * 60e3), capacity: 3, attendees: { create: [{ clientId: clientB }] } },
    });
    try {
      const res = await portal.get('/api/portal/pilates/availability');
      expect(res.status).toBe(200);
      expect(res.body.sessions).toEqual(expect.arrayContaining([expect.objectContaining({ id: session.id, free: 2 })]));
      expect(JSON.stringify(res.body)).not.toContain(clientB);
      expect(JSON.stringify(res.body)).not.toContain('Başka');
    } finally {
      await prisma.classSession.delete({ where: { id: session.id } });
    }
  });
});

describe('oturum sınırları', () => {
  it('danışan oturumu personel uçlarına erişemez', async () => {
    expect((await portal.get('/api/auth/me')).status).toBe(401);
    expect((await portal.get('/api/clients')).status).toBe(401);
    expect((await portal.get(`/api/clients/${clientA}/notes`)).status).toBe(401);
  });

  it('personel oturumu danışan uçlarına erişemez', async () => {
    expect((await staff.get('/api/portal/overview')).status).toBe(401);
  });

  it('CSRF başlığı olmadan durum değiştirilemez', async () => {
    const res = await portal.post('/api/portal/auth/change-password').send({ currentPassword: CLIENT_PASSWORD, newPassword: 'YeniSifre2026x' });
    expect(res.status).toBe(403);
  });

  it('hatalı şifreyle giriş olmaz, doğru şifreyle olur', async () => {
    expect((await request(app).post('/api/portal/auth/login').send({ email: CLIENT_EMAIL, password: 'YanlisSifre2026' })).status).toBe(401);
    expect((await request(app).post('/api/portal/auth/login').send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD })).status).toBe(200);
  });

  it('hesap kapatılınca açık oturum düşer', async () => {
    expect((await portal.get('/api/portal/overview')).status).toBe(200);
    const off = await staff.patch(`/api/clients/${clientA}/account`).set('X-CSRF-Token', staffCsrf).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.account.isActive).toBe(false);
    expect((await portal.get('/api/portal/overview')).status).toBe(401);
    expect((await request(app).post('/api/portal/auth/login').send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD })).status).toBe(401);
    void portalCsrf;
  });
});
