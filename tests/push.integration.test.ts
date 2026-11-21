// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mobil anlık bildirim (Expo push) entegrasyon testi — ağa çıkmaz, gönderici enjekte edilir:
 *  - Personel / danışan cihaz kaydı ve silme; token biçimi doğrulaması; CSRF
 *  - Aynı token başka hesaba kaydedilince sahiplik taşınır; başkasının token'ı silinemez
 *  - Personel olayı (notifyStaff) kayıtlı cihazlara push üretir; "push" tercihi kapatılınca üretmez
 *  - Danışana mesaj → danışanın cihazına push (metin içermez); DeviceNotRegistered → token silinir
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';
import { notifyStaff } from '../server/services/notifications';
import { flushPush, setPushSender, type ExpoMessage, type ExpoTicket } from '../server/services/push';

const app = createApp();
const stamp = Date.now().toString(36);
const STAFF = { email: `push-staff-${stamp}@example.com`, password: 'PushPersonel2026' };
const CLIENT = { email: `push-client-${stamp}@example.com`, password: 'PushDanisan2026' };
const MOBILE = { 'X-App-Client': 'mobile' };
const TOKEN_A = `ExponentPushToken[pushA${stamp}xxxxxxxx]`;
const TOKEN_B = `ExpoPushToken[pushB${stamp}yyyyyyyy]`;
let userId = '';
let clientId = '';
let accountId = '';
const staff = { token: '', csrf: '' };
const client = { token: '', csrf: '' };

const sent: ExpoMessage[] = [];
let respond: (m: ExpoMessage) => ExpoTicket = () => ({ status: 'ok', id: 'x' });

const auth = (s: { token: string; csrf: string }) => ({ Authorization: `Bearer ${s.token}`, 'X-CSRF-Token': s.csrf });

beforeAll(async () => {
  setPushSender(async (messages) => {
    sent.push(...messages);
    return messages.map((m) => respond(m));
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'DIETITIAN' } });
  userId = (
    await prisma.user.create({
      data: { email: STAFF.email, firstName: 'Push', lastName: 'Test', passwordHash: await hashPassword(STAFF.password), roleId: role.id },
    })
  ).id;
  const c = await prisma.client.create({
    data: { firstName: 'Push', lastName: `Danisan${stamp}`, phone: `+90534${String(Date.now()).slice(-7)}`, email: CLIENT.email, healthConsentAt: new Date(), kvkkNoticeAt: new Date() },
  });
  clientId = c.id;
  accountId = (
    await prisma.clientAccount.create({ data: { clientId, email: CLIENT.email, passwordHash: await hashPassword(CLIENT.password), activatedAt: new Date() } })
  ).id;

  const s = await request(app).post('/api/auth/login').set(MOBILE).send(STAFF);
  expect(s.status).toBe(200);
  Object.assign(staff, { token: s.body.token, csrf: s.body.csrfToken });
  const p = await request(app).post('/api/portal/auth/login').set(MOBILE).send(CLIENT);
  expect(p.status).toBe(200);
  Object.assign(client, { token: p.body.token, csrf: p.body.csrfToken });
});

afterEach(async () => {
  await flushPush();
  sent.length = 0;
  respond = () => ({ status: 'ok', id: 'x' });
});

afterAll(async () => {
  setPushSender(null);
  await prisma.pushDevice.deleteMany({ where: { token: { in: [TOKEN_A, TOKEN_B] } } });
  await prisma.notification.deleteMany({ where: { clientId } });
  await prisma.clientMessage.deleteMany({ where: { clientId } });
  await prisma.clientSession.deleteMany({ where: { account: { clientId } } });
  await prisma.clientAccount.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId }, { entityId: clientId }, { entityId: accountId }] } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe('cihaz kaydı', () => {
  it('token biçimi ve platform doğrulanır', async () => {
    for (const bad of [{ token: 'abc', platform: 'IOS' }, { token: 'ExponentPushToken[]', platform: 'IOS' }, { token: TOKEN_A, platform: 'WEB' }]) {
      const res = await request(app).post('/api/devices').set(auth(staff)).send(bad);
      expect(res.status).toBe(422);
    }
  });

  it('CSRF ve oturum zorunlu', async () => {
    expect((await request(app).post('/api/devices').set('Authorization', `Bearer ${staff.token}`).send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(403);
    expect((await request(app).post('/api/devices').send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(401);
    // Danışan token'ı personel ucunu, personel token'ı danışan ucunu açmaz
    expect((await request(app).post('/api/devices').set(auth(client)).send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(401);
    expect((await request(app).post('/api/portal/devices').set(auth(staff)).send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(401);
  });

  it('personel token kaydeder (tekrar kayıt idempotent)', async () => {
    expect((await request(app).post('/api/devices').set(auth(staff)).send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(200);
    expect((await request(app).post('/api/devices').set(auth(staff)).send({ token: TOKEN_A, platform: 'IOS' })).status).toBe(200);
    const rows = await prisma.pushDevice.findMany({ where: { token: TOKEN_A } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, clientAccountId: null, platform: 'IOS' });
    const prefs = await request(app).get('/api/settings/notification-prefs').set(auth(staff));
    expect(prefs.body.pushDevices).toBe(1);
    expect(prefs.body.prefs.push).toEqual({});
  });

  it('aynı token danışan hesabına kaydedilince sahiplik taşınır', async () => {
    const res = await request(app).post('/api/portal/devices').set(auth(client)).send({ token: TOKEN_A, platform: 'ANDROID' });
    expect(res.status).toBe(200);
    const row = await prisma.pushDevice.findUniqueOrThrow({ where: { token: TOKEN_A } });
    expect(row).toMatchObject({ userId: null, clientAccountId: accountId, platform: 'ANDROID' });
  });

  it('başkasının token’ı silinemez; sahibi siler (yol ya da gövde)', async () => {
    const other = await request(app).delete(`/api/devices/${encodeURIComponent(TOKEN_A)}`).set(auth(staff));
    expect(other.status).toBe(200);
    expect(other.body.removed).toBe(0);
    expect(await prisma.pushDevice.count({ where: { token: TOKEN_A } })).toBe(1);

    const own = await request(app).delete(`/api/portal/devices/${encodeURIComponent(TOKEN_A)}`).set(auth(client));
    expect(own.body.removed).toBe(1);
    expect(await prisma.pushDevice.count({ where: { token: TOKEN_A } })).toBe(0);

    await request(app).post('/api/devices').set(auth(staff)).send({ token: TOKEN_B, platform: 'ANDROID' });
    const byBody = await request(app).delete('/api/devices').set(auth(staff)).send({ token: TOKEN_B });
    expect(byBody.body.removed).toBe(1);
    expect((await request(app).delete('/api/devices').set(auth(staff)).send({ token: 'nope' })).status).toBe(422);
  });
});

describe('gönderim', () => {
  it('personel olayı kayıtlı cihaza push üretir (derin bağlantı ile)', async () => {
    await request(app).post('/api/devices').set(auth(staff)).send({ token: TOKEN_A, platform: 'IOS' });
    await notifyStaff('CLIENT_CREATED', { title: 'Yeni danışan kaydı: Push Test', clientId });
    await flushPush();
    const mine = sent.filter((m) => m.to === TOKEN_A);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'Yeni danışan kaydı: Push Test', data: { url: `/panel/danisanlar/${clientId}`, type: 'CLIENT_CREATED' } });
  });

  it('push tercihi kapatılınca gönderilmez', async () => {
    const patch = await request(app)
      .patch('/api/settings/notification-prefs')
      .set(auth(staff))
      .send({ inApp: {}, email: {}, push: { CLIENT_CREATED: false } });
    expect(patch.status).toBe(200);
    await notifyStaff('CLIENT_CREATED', { title: 'Yeni danışan kaydı: Push Test 2', clientId });
    await flushPush();
    expect(sent.filter((m) => m.to === TOKEN_A)).toHaveLength(0);
    // Eski istemci "push" alanını göndermezse tercih sıfırlanır (varsayılan: açık)
    expect((await request(app).patch('/api/settings/notification-prefs').set(auth(staff)).send({ inApp: {}, email: {} })).status).toBe(200);
  });

  it('danışana mesaj → danışanın cihazına içeriksiz push; DeviceNotRegistered → token silinir', async () => {
    await request(app).post('/api/portal/devices').set(auth(client)).send({ token: TOKEN_B, platform: 'ANDROID' });
    respond = (m) => (m.to === TOKEN_B ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' });
    const res = await request(app).post(`/api/clients/${clientId}/messages`).set(auth(staff)).send({ content: 'Gizli öneri metni' });
    expect(res.status).toBe(201);
    await flushPush();
    const mine = sent.filter((m) => m.to === TOKEN_B);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.data).toMatchObject({ url: '/hesabim/mesajlar' });
    expect(JSON.stringify(mine[0])).not.toContain('Gizli öneri');
    expect(await prisma.pushDevice.count({ where: { token: TOKEN_B } })).toBe(0);
  });

  it('danışan hesabı kapatılınca token’ları silinir', async () => {
    await request(app).post('/api/portal/devices').set(auth(client)).send({ token: TOKEN_B, platform: 'ANDROID' });
    expect(await prisma.pushDevice.count({ where: { token: TOKEN_B } })).toBe(1);
    // portal:manage yalnızca yöneticide
    const a = await request(app).post('/api/auth/login').set(MOBILE).send({ email: 'nida@example.com', password: 'GucluSifre2026' });
    expect(a.status).toBe(200);
    const admin = { token: a.body.token as string, csrf: a.body.csrfToken as string };
    const res = await request(app).patch(`/api/clients/${clientId}/account`).set(auth(admin)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(await prisma.pushDevice.count({ where: { token: TOKEN_B } })).toBe(0);
    await request(app).post('/api/auth/logout').set(auth(admin));
  });
});
