// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mağaza incelemesi rolü (REVIEWER) entegrasyon testi (server/auth/reviewer.ts):
 *  - Yalnızca demo (isDemo) danışanları ve onlara bağlı kayıtları görür; gerçek danışanın kaydı 404
 *  - Listeler ve panel özeti gerçek danışanı içermez
 *  - Hiçbir şeyi değiştiremez; kapalı bölümler (raporlar, denetim, pilates, kullanıcılar) 403
 *  - Personel bildirimlerini almaz
 * Kendi kayıtlarını oluşturur, sonunda siler. REVIEWER rolü migration ile oluşturulur.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/lib/db';
import { encryptJson, hashPassword } from '../server/lib/crypto';
import { notifyStaff } from '../server/services/notifications';
import { samplePlanTemplate } from '../shared/plan';

const app = createApp();
const stamp = Date.now().toString(36);
const REV = { email: `reviewer-${stamp}@example.com`, password: 'IncelemeSifre2026' };
const rev = request.agent(app);
let csrf = '';
let userId = '';
let realClient = '';
let demoClient = '';
let realAppt = '';
let demoAppt = '';
let realPlan = '';
let demoPlan = '';
let templatePlan = '';
let demoPhone = '';
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'REVIEWER' } });
  userId = (await prisma.user.create({ data: { email: REV.email, firstName: 'Google', lastName: 'Inceleme', passwordHash: await hashPassword(REV.password), roleId: role.id } })).id;
  const phone = () => `+90555${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  realClient = (await prisma.client.create({ data: { firstName: 'Gercek', lastName: `Danisan${stamp}`, phone: phone(), healthConsentAt: new Date() } })).id;
  demoPhone = phone();
  demoClient = (await prisma.client.create({ data: { firstName: 'Demo', lastName: `Danisan${stamp}`, phone: demoPhone, isDemo: true, healthConsentAt: new Date() } })).id;
  const at = new Date(`${today}T10:00:00+03:00`);
  realAppt = (await prisma.appointment.create({ data: { clientId: realClient, contactName: `Gercek Danisan${stamp}`, contactPhone: '5550000000', status: 'CONFIRMED', startsAt: at, endsAt: new Date(at.getTime() + 45 * 60_000) } })).id;
  demoAppt = (await prisma.appointment.create({ data: { clientId: demoClient, contactName: `Demo Danisan${stamp}`, contactPhone: '5550000001', status: 'CONFIRMED', startsAt: at, endsAt: new Date(at.getTime() + 45 * 60_000) } })).id;
  realPlan = (await prisma.nutritionPlan.create({ data: { clientId: realClient, name: `Gercek plan ${stamp}`, dataEnc: encryptJson(samplePlanTemplate()) } })).id;
  demoPlan = (await prisma.nutritionPlan.create({ data: { clientId: demoClient, name: `Demo plan ${stamp}`, dataEnc: encryptJson(samplePlanTemplate()) } })).id;
  templatePlan = (await prisma.nutritionPlan.create({ data: { isTemplate: true, name: `Sablon ${stamp}`, dataEnc: encryptJson(samplePlanTemplate()) } })).id;

  expect((await rev.post('/api/auth/login').send(REV)).status).toBe(200);
  csrf = (await rev.get('/api/auth/me')).body.user.csrfToken;
});

afterAll(async () => {
  const clients = [realClient, demoClient];
  await prisma.notification.deleteMany({ where: { OR: [{ userId }, { clientId: { in: clients } }] } });
  await prisma.appointment.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.nutritionPlan.deleteMany({ where: { id: templatePlan } });
  await prisma.client.deleteMany({ where: { id: { in: clients } } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe('inceleme rolü: yalnızca demo veriler', () => {
  it('danışan listesi yalnızca demo danışanları içerir', async () => {
    const res = await rev.get('/api/clients').query({ q: `Danisan${stamp}` });
    expect(res.status).toBe(200);
    const ids = res.body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(demoClient);
    expect(ids).not.toContain(realClient);
  });

  it('gerçek danışanın kaydı ve alt kayıtları 404, demo danışanınki açık', async () => {
    for (const sub of ['', '/notes', '/measurements', '/files', '/appointments', '/export', '/messages']) {
      expect((await rev.get(`/api/clients/${realClient}${sub}`)).status, `clients/:real${sub}`).toBe(404);
    }
    expect((await rev.get(`/api/clients/${demoClient}`)).status).toBe(200);
    expect((await rev.get(`/api/clients/${demoClient}/measurements`)).status).toBe(200);
  });

  it('randevular: liste ve tekil kayıt gerçek danışanı göstermez', async () => {
    const list = await rev.get('/api/appointments').query({ from: today, to: today });
    expect(list.status).toBe(200);
    const ids = list.body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(demoAppt);
    expect(ids).not.toContain(realAppt);
    expect((await rev.get(`/api/appointments/${realAppt}`)).status).toBe(404);
    expect((await rev.get(`/api/appointments/${demoAppt}`)).status).toBe(200);
  });

  it('panel özeti (gündem) gerçek danışanı göstermez', async () => {
    const res = await rev.get('/api/dashboard/agenda').query({ date: today });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(`Gercek Danisan${stamp}`);
  });

  it('planlar: liste ve tekil kayıt gerçek danışanı göstermez', async () => {
    const list = await rev.get('/api/plans');
    expect(list.status).toBe(200);
    const ids = list.body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(demoPlan);
    expect(ids).not.toContain(realPlan);
    // Şablonlar gerçek bir danışanın planından türetilmiş olabilir
    expect(ids).not.toContain(templatePlan);
    expect((await rev.get(`/api/plans/${templatePlan}`)).status).toBe(404);
    expect((await rev.get(`/api/plans/${realPlan}`)).status).toBe(404);
    expect((await rev.get(`/api/plans/${realPlan}/print`)).status).toBe(404);
    expect((await rev.get(`/api/plans/${demoPlan}`)).status).toBe(200);
  });
});

describe('web sitesi talebi demo danışana bağlanmaz', () => {
  it('demo danışanın telefonuyla gelen gerçek talep demo kayda eklenmez', async () => {
    const { findClientByContact } = await import('../server/services/appointments');
    expect(await findClientByContact(prisma, demoPhone, null)).toBeNull();
  });
});

describe('inceleme rolü: salt okunur ve kapalı bölümler', () => {
  it('hiçbir değişiklik yapamaz', async () => {
    const h = { 'X-CSRF-Token': csrf };
    expect((await rev.post('/api/clients').set(h).send({ firstName: 'X', lastName: 'Y', phone: '+905550000000' })).status).toBe(403);
    expect((await rev.patch(`/api/clients/${demoClient}`).set(h).send({ firstName: 'Z' })).status).toBe(403);
    expect((await rev.delete(`/api/clients/${demoClient}`).set(h)).status).toBe(403);
    expect((await rev.post(`/api/appointments/${demoAppt}/status`).set(h).send({ status: 'CANCELLED' })).status).toBe(403);
    expect((await rev.post('/api/auth/change-password').set(h).send({ currentPassword: REV.password, newPassword: 'BaskaSifre2026x' })).status).toBe(403);
  });

  it('cihaz kaydı yapamaz (başkasının bildirim kaydını devralamaz)', async () => {
    const res = await rev.post('/api/devices').set('X-CSRF-Token', csrf).send({ token: 'ExponentPushToken[reviewer-test]', platform: 'ANDROID' });
    expect(res.status).toBe(403);
  });

  it('raporlar, denetim kaydı, pilates ve kullanıcılar kapalı', async () => {
    for (const p of ['/api/reports', '/api/reports/export.csv', '/api/audit-logs', '/api/classes/groups', '/api/settings/users', '/api/settings/smtp']) {
      expect((await rev.get(p)).status, p).toBe(403);
    }
  });

  it('personel bildirimlerini almaz', async () => {
    await notifyStaff('CLIENT_CREATED', { title: `Test bildirimi ${stamp}`, clientId: realClient });
    expect(await prisma.notification.count({ where: { userId } })).toBe(0);
  });
});
