// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ayarlar → E-posta & WhatsApp entegrasyon testi:
 *  - SMTP şifresi ve WhatsApp erişim anahtarı hiçbir yanıtta dönmez (yalnızca hasPassword / hasToken)
 *  - Şifre/anahtar boş bırakılarak kaydedilirse mevcut değer korunur
 *  - Veritabanında düz metin tutulmaz; herkese açık ayar uç noktası bu değerleri içermez
 *  - Diyetisyen dahil settings:write yetkisi olmayanlar ayarlara erişemez (asistan: 403)
 * Kendi kullanıcılarını oluşturur; test sonunda eski ayar değerlerini geri yükler.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';

const app = createApp();
const stamp = Date.now().toString(36);
const ADMIN = { email: `int-admin-${stamp}@example.com`, password: 'YoneticiSifre2026' };
const ASSIST = { email: `int-asst-${stamp}@example.com`, password: 'AsistanSifre2026' };
const admin = request.agent(app);
const asst = request.agent(app);
let csrf = '';
let asstCsrf = '';
const ids: string[] = [];
const KEYS = ['integration.smtp', 'integration.whatsappCloud'];
let backup: { key: string; value: unknown }[] = [];

const PASS = `smtp-secret-${stamp}`;
const TOKEN = `EAAG-token-${stamp}`;
const smtpBody = { host: 'smtp.example.invalid', port: 587, secure: false, username: 'user', password: PASS, fromName: 'Nida Akın', fromEmail: 'info@example.com' };
const waBody = {
  enabled: true, phoneNumberId: '123456789', accessToken: TOKEN, apiVersion: 'v21.0', templateLanguage: 'tr', staffNumber: '905551234567',
  templates: { requestStaff: 'yeni_talep', confirmedClient: 'randevu_onay', reminderClient: 'randevu_hatirlatma' },
};

async function staff(roleKey: 'ADMIN' | 'ASSISTANT', c: { email: string; password: string }) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  ids.push((await prisma.user.create({ data: { email: c.email, firstName: 'Test', lastName: roleKey, passwordHash: await hashPassword(c.password), roleId: role.id } })).id);
}

beforeAll(async () => {
  backup = await prisma.websiteSetting.findMany({ where: { key: { in: KEYS } }, select: { key: true, value: true } });
  await prisma.websiteSetting.deleteMany({ where: { key: { in: KEYS } } });
  await staff('ADMIN', ADMIN);
  await staff('ASSISTANT', ASSIST);
  expect((await admin.post('/api/auth/login').send(ADMIN)).status).toBe(200);
  csrf = (await admin.get('/api/auth/me')).body.user.csrfToken;
  expect((await asst.post('/api/auth/login').send(ASSIST)).status).toBe(200);
  asstCsrf = (await asst.get('/api/auth/me')).body.user.csrfToken;
});

afterAll(async () => {
  await prisma.websiteSetting.deleteMany({ where: { key: { in: KEYS } } });
  for (const b of backup) await prisma.websiteSetting.create({ data: { key: b.key, value: b.value as never } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { entityId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('SMTP ayarları', () => {
  it('asistan erişemez', async () => {
    expect((await asst.get('/api/settings/smtp')).status).toBe(403);
    expect((await asst.put('/api/settings/smtp').set('X-CSRF-Token', asstCsrf).send(smtpBody)).status).toBe(403);
  });

  it('şifre kaydedilir ama yanıtta dönmez', async () => {
    const put = await admin.put('/api/settings/smtp').set('X-CSRF-Token', csrf).send(smtpBody);
    expect(put.status).toBe(200);
    expect(put.body.smtp.hasPassword).toBe(true);
    expect(JSON.stringify(put.body)).not.toContain(PASS);
    const get = await admin.get('/api/settings/smtp');
    expect(get.body.smtp).toMatchObject({ host: smtpBody.host, hasPassword: true });
    expect(JSON.stringify(get.body)).not.toContain(PASS);
    const row = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.smtp' } });
    expect(JSON.stringify(row.value)).not.toContain(PASS);
  });

  it('boş şifreyle kaydetmek mevcut şifreyi korur', async () => {
    const before = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.smtp' } });
    const { password: _p, ...noPass } = smtpBody;
    const res = await admin.put('/api/settings/smtp').set('X-CSRF-Token', csrf).send({ ...noPass, host: 'smtp2.example.invalid', password: '' });
    expect(res.status).toBe(200);
    expect(res.body.smtp).toMatchObject({ host: 'smtp2.example.invalid', hasPassword: true });
    const after = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.smtp' } });
    expect((after.value as { passwordEnc: string }).passwordEnc).toBe((before.value as { passwordEnc: string }).passwordEnc);
  });

  it('geçersiz port 422 döner', async () => {
    expect((await admin.put('/api/settings/smtp').set('X-CSRF-Token', csrf).send({ ...smtpBody, port: 0 })).status).toBe(422);
  });
});

describe('WhatsApp Cloud API ayarları', () => {
  it('anahtar kaydedilir ama yanıtta dönmez', async () => {
    const put = await admin.put('/api/settings/whatsapp').set('X-CSRF-Token', csrf).send(waBody);
    expect(put.status).toBe(200);
    expect(put.body.whatsapp.hasToken).toBe(true);
    expect(JSON.stringify(put.body)).not.toContain(TOKEN);
    expect(JSON.stringify((await admin.get('/api/settings/whatsapp')).body)).not.toContain(TOKEN);
    const row = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.whatsappCloud' } });
    expect(JSON.stringify(row.value)).not.toContain(TOKEN);
  });

  it('boş anahtarla kaydetmek mevcut anahtarı korur', async () => {
    const before = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.whatsappCloud' } });
    const res = await admin.put('/api/settings/whatsapp').set('X-CSRF-Token', csrf).send({ ...waBody, accessToken: '', staffNumber: '905559876543' });
    expect(res.status).toBe(200);
    expect(res.body.whatsapp).toMatchObject({ hasToken: true, staffNumber: '905559876543' });
    const after = await prisma.websiteSetting.findUniqueOrThrow({ where: { key: 'integration.whatsappCloud' } });
    expect((after.value as { tokenEnc: string }).tokenEnc).toBe((before.value as { tokenEnc: string }).tokenEnc);
  });

  it('anahtarsız etkinleştirme reddedilir', async () => {
    await prisma.websiteSetting.deleteMany({ where: { key: 'integration.whatsappCloud' } });
    const res = await admin.put('/api/settings/whatsapp').set('X-CSRF-Token', csrf).send({ ...waBody, accessToken: '' });
    expect(res.status).toBe(422);
  });
});

describe('sızıntı kontrolü', () => {
  it('içerik ayarları ve herkese açık ayarlar gizli değer içermez', async () => {
    await admin.put('/api/settings/smtp').set('X-CSRF-Token', csrf).send(smtpBody);
    await admin.put('/api/settings/whatsapp').set('X-CSRF-Token', csrf).send(waBody);
    const content = await admin.get('/api/content/settings');
    expect(content.status).toBe(200);
    const pub = await request(app).get('/api/public/site');
    for (const res of [content, pub]) {
      const txt = JSON.stringify(res.body);
      expect(txt).not.toContain(PASS);
      expect(txt).not.toContain(TOKEN);
      expect(txt).not.toMatch(/passwordEnc|tokenEnc/);
    }
  });
});
