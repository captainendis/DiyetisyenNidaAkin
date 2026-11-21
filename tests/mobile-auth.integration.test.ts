// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mobil uygulama oturumu (Authorization: Bearer) entegrasyon testi:
 *  - "X-App-Client: mobile" ile girişte token + CSRF gövdede döner, cookie yazılmaz
 *  - Bearer token ile personel/danışan uçlarına erişilir; CSRF yine zorunludur
 *  - Personel token'ı danışan uçlarını, danışan token'ı personel uçlarını açmaz
 *  - Çıkış token'ı geçersiz kılar; tarayıcı girişi (başlıksız) token döndürmez
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';

const app = createApp();
const stamp = Date.now().toString(36);
const STAFF = { email: `mobile-staff-${stamp}@example.com`, password: 'MobilPersonel2026' };
const CLIENT = { email: `mobile-client-${stamp}@example.com`, password: 'MobilDanisan2026' };
const MOBILE = { 'X-App-Client': 'mobile' };
let userId = '';
let clientId = '';

beforeAll(async () => {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'DIETITIAN' } });
  userId = (
    await prisma.user.create({
      data: { email: STAFF.email, firstName: 'Mobil', lastName: 'Test', passwordHash: await hashPassword(STAFF.password), roleId: role.id },
    })
  ).id;
  const client = await prisma.client.create({
    data: { firstName: 'Mobil', lastName: `Danisan${stamp}`, phone: `+90533${String(Date.now()).slice(-7)}`, email: CLIENT.email, healthConsentAt: new Date(), kvkkNoticeAt: new Date() },
  });
  clientId = client.id;
  await prisma.clientAccount.create({
    data: { clientId, email: CLIENT.email, passwordHash: await hashPassword(CLIENT.password), activatedAt: new Date() },
  });
});

afterAll(async () => {
  await prisma.clientSession.deleteMany({ where: { account: { clientId } } });
  await prisma.clientAccount.deleteMany({ where: { clientId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe('mobil personel oturumu', () => {
  let token = '';
  let csrf = '';

  it('girişte token döner, cookie yazılmaz', async () => {
    const res = await request(app).post('/api/auth/login').set(MOBILE).send(STAFF);
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers['set-cookie']).toBeUndefined();
    token = res.body.token;
    csrf = res.body.csrfToken;
  });

  it('Bearer ile /me ve personel uçları açılır', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(STAFF.email);
    expect(me.body.user.csrfToken).toBe(csrf);
    expect((await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)).status).not.toBe(401);
  });

  it('durum değiştiren isteklerde CSRF zorunlu', async () => {
    const noCsrf = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({});
    expect(noCsrf.status).toBe(403);
  });

  it('personel token’ı danışan uçlarını açmaz', async () => {
    expect((await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('çıkış token’ı geçersiz kılar', async () => {
    expect((await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('tarayıcı girişi token döndürmez', async () => {
    const res = await request(app).post('/api/auth/login').send(STAFF);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(String(res.headers['set-cookie'])).toContain('na_sid=');
  });
});

describe('mobil danışan oturumu', () => {
  let token = '';

  it('girişte token döner ve portal uçları açılır', async () => {
    const res = await request(app).post('/api/portal/auth/login').set(MOBILE).send(CLIENT);
    expect(res.status).toBe(200);
    token = res.body.token;
    expect(token).toBeTruthy();
    const me = await request(app).get('/api/portal/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.me.email).toBe(CLIENT.email);
    expect(me.body.me.phone).toMatch(/^\+90533/);
    expect((await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('danışan token’ı personel uçlarını açmaz', async () => {
    expect((await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('bozuk Authorization başlığı yok sayılır', async () => {
    expect((await request(app).get('/api/portal/auth/me').set('Authorization', 'Bearer short')).status).toBe(401);
  });
});
