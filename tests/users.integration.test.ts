// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel kullanıcısı ekleme (Ayarlar → Kullanıcılar) entegrasyon testi:
 *  - Yalnızca users:manage (yönetici) ekleyebilir; diyetisyen ekleyemez
 *  - Yeni kullanıcı bağlantıyla şifresini belirleyene kadar giriş yapamaz; bağlantı tek kullanımlık
 *  - Yeniden üretilen bağlantı öncekini geçersiz kılar
 * Kendi kullanıcılarını oluşturur, sonunda siler. Roller seed ile oluşturulmuş olmalı.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';

const app = createApp();
const stamp = Date.now().toString(36);
const ADMIN = { email: `users-admin-${stamp}@example.com`, password: 'YoneticiSifre2026' };
const DIET = { email: `users-diet-${stamp}@example.com`, password: 'DiyetisyenSifre2026' };
const NEW_EMAIL = `asistan-${stamp}@example.com`;
const admin = request.agent(app);
const diet = request.agent(app);
let adminCsrf = '';
let dietCsrf = '';
const createdIds: string[] = [];

async function staff(roleKey: 'ADMIN' | 'DIETITIAN', c: { email: string; password: string }) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const u = await prisma.user.create({ data: { email: c.email, firstName: 'Test', lastName: roleKey, passwordHash: await hashPassword(c.password), roleId: role.id } });
  createdIds.push(u.id);
}

const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;

beforeAll(async () => {
  await staff('ADMIN', ADMIN);
  await staff('DIETITIAN', DIET);
  expect((await admin.post('/api/auth/login').send(ADMIN)).status).toBe(200);
  adminCsrf = (await admin.get('/api/auth/me')).body.user.csrfToken;
  expect((await diet.post('/api/auth/login').send(DIET)).status).toBe(200);
  dietCsrf = (await diet.get('/api/auth/me')).body.user.csrfToken;
});

afterAll(async () => {
  const extra = await prisma.user.findMany({ where: { email: NEW_EMAIL }, select: { id: true } });
  const ids = [...createdIds, ...extra.map((u) => u.id)];
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { entityId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('panel kullanıcısı ekleme', () => {
  const body = { firstName: 'Ayşe', lastName: 'Asistan', email: NEW_EMAIL, role: 'ASSISTANT' };
  let firstLink = '';

  it('diyetisyen kullanıcı ekleyemez', async () => {
    expect((await diet.post('/api/settings/users').set('X-CSRF-Token', dietCsrf).send(body)).status).toBe(403);
  });

  it('doğrulama hataları alan bazında döner', async () => {
    const res = await admin.post('/api/settings/users').set('X-CSRF-Token', adminCsrf).send({ firstName: '', lastName: '', email: 'x', role: 'ROOT' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email', 'role']));
  });

  it('yönetici ekler; bağlantı döner, kullanıcı henüz giriş yapamaz', async () => {
    const res = await admin.post('/api/settings/users').set('X-CSRF-Token', adminCsrf).send(body);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: NEW_EMAIL, role: { key: 'ASSISTANT' } });
    expect(res.body.link.link).toContain('/panel/sifre-sifirla?token=');
    firstLink = res.body.link.link;
    // Bağlantıdaki token DB'de düz tutulmaz
    expect(await prisma.passwordResetToken.count({ where: { tokenHash: tokenOf(firstLink) } })).toBe(0);
    expect((await request(app).post('/api/auth/login').send({ email: NEW_EMAIL, password: 'AsistanSifre2026' })).status).toBe(401);
  });

  it('aynı e-posta ikinci kez eklenemez', async () => {
    expect((await admin.post('/api/settings/users').set('X-CSRF-Token', adminCsrf).send(body)).status).toBe(409);
  });

  it('yeni bağlantı öncekini geçersiz kılar; şifre belirlenince giriş olur ve rol yetkileri doğru', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: NEW_EMAIL } });
    const again = await admin.post(`/api/settings/users/${u.id}/link`).set('X-CSRF-Token', adminCsrf);
    expect(again.status).toBe(200);
    const secondLink = again.body.link.link;
    expect((await request(app).post('/api/auth/reset-password').send({ token: tokenOf(firstLink), password: 'AsistanSifre2026' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: tokenOf(secondLink), password: 'AsistanSifre2026' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: tokenOf(secondLink), password: 'BaskaSifre2026' })).status).toBe(400);

    const asst = request.agent(app);
    expect((await asst.post('/api/auth/login').send({ email: NEW_EMAIL, password: 'AsistanSifre2026' })).status).toBe(200);
    const me = (await asst.get('/api/auth/me')).body.user;
    expect(me.role).toBe('ASSISTANT');
    expect(me.permissions).not.toContain('clinical:read');
    expect((await asst.get('/api/settings/users')).status).toBe(403);
  });
});
