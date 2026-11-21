// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı API'si (/api/portal) — "Hesabım".
 *
 * Güvenlik sınırı: her uç yalnızca req.portalUser.clientId'ye bağlı kayıtları döndürür. Kimlikler URL'den
 * gelse bile sorgu daima clientId ile birlikte yapılır (başka danışanın kaydı 404 döner, varlığı sızmaz).
 * Danışan şunları GÖRMEZ: klinik görüşme notları, ölçüm notları, randevu dahili notları, gizlenmiş dosyalar.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/db';
import { burnPasswordCheck, decryptBuffer, decryptJson, decryptString, hashPassword, sha256, verifyPassword } from '../lib/crypto';
import { HttpError, badRequest, body, notFound, parse, query, router, sendBuffer, unauthorized, type Ctx } from '../lib/http';
import { audit } from '../lib/audit';
import { PRIVATE_UPLOADS } from '../lib/storage';
import { loginLimiter, passwordResetLimiter } from '../middleware/rate-limit';
import { createClientSession, destroyClientSession, loadClientSession, portalUser, requireClientAuth } from '../auth/client-session';
import { emailAccountLink, issueAccountLink } from '../services/client-accounts';
import { isEmailConfigured } from '../services/mailer';
import { decryptContent } from '../services/recipe-content';
import { decryptNote } from '../services/recipe-notes';
import { renderPlanPrintPage } from '../services/print';
import { decodePlan } from './plans';
import { resolvePlanRecipes } from './recipes';
import {
  portalChangePasswordSchema,
  portalForgotSchema,
  portalLoginSchema,
  portalPilatesRequestSchema,
  portalSetPasswordSchema,
  portalTokenQuerySchema,
  type PortalAppointment,
  type PortalFile,
  type PortalMeasurement,
  type PortalMessage,
  type PortalOverview,
  type PortalPilates,
  type PortalPilatesAvailability,
  type PortalRequest,
  type PortalPlan,
  type PortalPlanListItem,
  type PortalRecipe,
  type PortalRecipeCard,
} from '../../shared/portal';
import { pickCircumferences, type Circumferences } from '../../shared/measurements';
import type { PortalClassSession } from '../../shared/classes';
import { CLASS_SEAT_HOLDING, DAYPARTS, PILATES_FORMAT_LABEL, parseDayparts, parseDays, pilatesPreferenceText } from '../../shared/constants';
import { notifyStaff } from '../services/notifications';
import { publicFormLimiter } from '../middleware/rate-limit';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const portalRouter = router();
portalRouter.use('*', loadClientSession);

/** Danışan eylemleri için denetim kaydı: personel kullanıcısı yok, kim olduğu metadata'da */
function portalAudit(c: Ctx, action: string, accountId: string | null, meta: Record<string, unknown> = {}) {
  return audit(c, action, 'client_account', accountId, { actor: 'client', ...meta });
}

function idParam(c: Ctx, key = 'id') {
  const v = c.req.param(key);
  if (typeof v !== 'string' || v.length > 40) throw badRequest('Geçersiz kimlik');
  return v;
}

// ───────────────────────── Kimlik ─────────────────────────

portalRouter.post('/auth/login', loginLimiter, async (c) => {
  const { email, password, remember } = parse(portalLoginSchema, await body(c));
  const account = await prisma.clientAccount.findUnique({ where: { email }, include: { client: { select: { status: true } } } });
  const generic = new HttpError(401, 'INVALID_CREDENTIALS', 'E-posta adresi veya şifre hatalı');

  if (!account || !account.isActive || !account.passwordHash || account.client.status === 'ARCHIVED') {
    await burnPasswordCheck(password);
    await portalAudit(c, 'portal.login_failed', account?.id ?? null, { reason: account ? 'inactive_or_not_activated' : 'unknown' });
    throw generic;
  }
  if (account.lockedUntil && account.lockedUntil > new Date()) {
    const mins = Math.ceil((account.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(423, 'ACCOUNT_LOCKED', `Çok sayıda hatalı deneme nedeniyle hesabınız geçici olarak kilitlendi. ${mins} dakika sonra tekrar deneyin.`);
  }
  if (!(await verifyPassword(password, account.passwordHash))) {
    const failed = account.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.clientAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await portalAudit(c, lock ? 'portal.account_locked' : 'portal.login_failed', account.id);
    throw generic;
  }
  await prisma.clientAccount.update({ where: { id: account.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const session = await createClientSession(c, account.id, remember);
  await portalAudit(c, 'portal.login', account.id, { remember, mobile: !!session.token });
  // Mobil uygulama: ham token + CSRF yalnızca burada bir kez döner
  return c.json(session.token ? { ok: true, token: session.token, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() } : { ok: true });
});

portalRouter.post('/auth/logout', async (c) => {
  const current = c.var.portalUser;
  if (current) await portalAudit(c, 'portal.logout', current.accountId);
  await destroyClientSession(c);
  return c.json({ ok: true });
});

/**
 * Danışanın aldığı hizmetler. Pilates: bir gruba üye, bir derse kayıtlı ya da pilates talebi var.
 * Beslenme: listesi, ölçümü, kişisel tarifi ya da danışmanlık randevusu var; hiçbir iz yoksa varsayılan beslenmedir.
 */
async function clientPrograms(clientId: string) {
  const [groups, classes, pilatesReq, plans, measurements, recipes, consults] = await Promise.all([
    prisma.classGroupMember.count({ where: { clientId } }),
    prisma.classAttendance.count({ where: { clientId } }),
    prisma.appointment.count({ where: { clientId, kind: 'PILATES' } }),
    prisma.nutritionPlan.count({ where: { clientId } }),
    prisma.measurement.count({ where: { clientId } }),
    prisma.recipe.count({ where: { clientId } }),
    prisma.appointment.count({ where: { clientId, kind: 'CONSULTATION' } }),
  ]);
  const pilates = groups + classes + pilatesReq > 0;
  const nutrition = plans + measurements + recipes + consults > 0 || !pilates;
  return { nutrition, pilates };
}

portalRouter.get('/auth/me', async (c) => {
  const u = c.var.portalUser;
  if (!u) throw unauthorized();
  const [programs, client] = await Promise.all([clientPrograms(u.clientId), prisma.client.findUnique({ where: { id: u.clientId }, select: { phone: true } })]);
  // phone: randevu talebi formunu (mobil uygulama) önceden doldurmak için — danışanın kendi kaydı
  return c.json({ me: { firstName: u.firstName, lastName: u.lastName, email: u.email, phone: client?.phone ?? null, csrfToken: u.csrfToken, programs } });
});

async function findValidToken(token: string) {
  const t = await prisma.clientAccountToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { account: { include: { client: { select: { firstName: true, status: true } } } } },
  });
  if (!t || t.usedAt || t.expiresAt < new Date() || !t.account.isActive || t.account.client.status === 'ARCHIVED') {
    throw new HttpError(400, 'INVALID_TOKEN', 'Bu bağlantı geçersiz ya da süresi dolmuş. Diyetisyeninizden yeni bir bağlantı isteyebilirsiniz.');
  }
  return t;
}

/** Bağlantı sayfası açılırken: geçerli mi, kime ait (selamlama için yalnızca ad) */
portalRouter.get('/auth/token', passwordResetLimiter, async (c) => {
  const { token } = parse(portalTokenQuerySchema, query(c));
  const t = await findValidToken(token);
  return c.json({ purpose: t.purpose, firstName: t.account.client.firstName, email: t.account.email });
});

/** Etkinleştirme ya da sıfırlama: şifreyi belirler, eski oturumları kapatır ve danışanı oturum açmış hâle getirir */
portalRouter.post('/auth/set-password', passwordResetLimiter, async (c) => {
  const { token, password } = parse(portalSetPasswordSchema, await body(c));
  const t = await findValidToken(token);
  const now = new Date();
  // Eski oturumlar aynı işlemde silinir; damga 1 sn geriden yazılır ki hemen ardından açılan yeni oturum
  // (DB saatiyle createdAt) "şifre değişmeden önce açılmış" sayılmasın.
  const changedAt = new Date(now.getTime() - 1000);
  await prisma.$transaction([
    prisma.clientAccount.update({
      where: { id: t.accountId },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: changedAt,
        activatedAt: t.account.activatedAt ?? now,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    }),
    prisma.clientAccountToken.updateMany({ where: { accountId: t.accountId, usedAt: null }, data: { usedAt: now } }),
    prisma.clientSession.deleteMany({ where: { accountId: t.accountId } }),
  ]);
  const session = await createClientSession(c, t.accountId, false);
  await portalAudit(c, t.purpose === 'ACTIVATE' ? 'portal.activated' : 'portal.password_reset', t.accountId);
  return c.json(session.token ? { ok: true, token: session.token, csrfToken: session.csrfToken } : { ok: true });
});

portalRouter.post('/auth/forgot-password', passwordResetLimiter, async (c) => {
  const { email } = parse(portalForgotSchema, await body(c));
  const configured = await isEmailConfigured();
  const response = {
    ok: true,
    emailConfigured: configured,
    message: configured
      ? 'Bu adrese kayıtlı bir danışan hesabı varsa şifre sıfırlama bağlantısı gönderildi.'
      : 'Şifrenizi sıfırlamak için diyetisyeninizle iletişime geçin; size yeni bir giriş bağlantısı gönderebilir.',
  };
  if (!configured) return c.json(response);
  const account = await prisma.clientAccount.findUnique({ where: { email }, include: { client: { select: { firstName: true, status: true } } } });
  // Hesabın varlığı yanıttan anlaşılmamalı
  if (!account || !account.isActive || !account.passwordHash || account.client.status === 'ARCHIVED') return c.json(response);
  const { link } = await issueAccountLink(account.id, 'RESET');
  await emailAccountLink(account.email, account.client.firstName, 'RESET', link);
  await portalAudit(c, 'portal.password_reset_requested', account.id);
  return c.json(response);
});

// ── Bundan sonraki her uç danışan oturumu gerektirir ──
portalRouter.use('*', requireClientAuth);

portalRouter.post('/auth/change-password', async (c) => {
  const { currentPassword, newPassword } = parse(portalChangePasswordSchema, await body(c));
  const u = portalUser(c);
  const account = await prisma.clientAccount.findUniqueOrThrow({ where: { id: u.accountId } });
  if (!account.passwordHash || !(await verifyPassword(currentPassword, account.passwordHash))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Mevcut şifre hatalı', { fields: { currentPassword: 'Mevcut şifre hatalı' } });
  }
  const changedAt = new Date(Date.now() - 1000); // bkz. set-password
  await prisma.$transaction([
    prisma.clientAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: changedAt } }),
    prisma.clientSession.deleteMany({ where: { accountId: account.id } }),
  ]);
  const session = await createClientSession(c, account.id, false);
  await portalAudit(c, 'portal.password_changed', account.id);
  return c.json(session.token ? { ok: true, token: session.token, csrfToken: session.csrfToken } : { ok: true });
});

// ───────────────────────── Yardımcılar ─────────────────────────

const apptSelect = {
  id: true, startsAt: true, endsAt: true, status: true, meetingType: true, kind: true, service: { select: { title: true } },
} as const;

function toAppointment(a: { id: string; startsAt: Date | null; endsAt: Date | null; status: PortalAppointment['status']; meetingType: PortalAppointment['meetingType']; kind: 'CONSULTATION' | 'PILATES'; service: { title: string } | null }): PortalAppointment {
  return {
    id: a.id,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    status: a.status,
    meetingType: a.meetingType,
    service: a.kind === 'PILATES' ? 'Pilates' : (a.service?.title ?? null),
  };
}

function toPlanItem(p: { id: string; name: string; createdAt: Date; updatedAt: Date }): PortalPlanListItem {
  return { id: p.id, name: p.name, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

function safeDecrypt(enc: string) {
  try {
    return decryptString(enc);
  } catch {
    return '';
  }
}

const messageInclude = {
  author: { select: { firstName: true, lastName: true } },
  appointment: { select: { startsAt: true } },
} as const;

function toMessage(m: { id: string; contentEnc: string; createdAt: Date; updatedAt: Date; author: { firstName: string; lastName: string } | null; appointment: { startsAt: Date | null } | null }): PortalMessage {
  return {
    id: m.id,
    content: safeDecrypt(m.contentEnc),
    appointmentAt: m.appointment?.startsAt?.toISOString() ?? null,
    author: m.author ? `${m.author.firstName} ${m.author.lastName}` : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function toMeasurement(m: { id: string; measuredOn: string; dataEnc: string }): PortalMeasurement {
  let d: { heightCm?: number | null; weightKg?: number | null; targetWeightKg?: number | null; bodyFatPct?: number | null; muscleKg?: number | null } & Partial<Circumferences> = {};
  try {
    d = decryptJson(m.dataEnc);
  } catch {
    /* çözülemeyen ölçüm boş gösterilir */
  }
  return { id: m.id, measuredOn: m.measuredOn, heightCm: d.heightCm ?? null, weightKg: d.weightKg ?? null, targetWeightKg: d.targetWeightKg ?? null, bodyFatPct: d.bodyFatPct ?? null, muscleKg: d.muscleKg ?? null, ...pickCircumferences(d) };
}

/** Danışanın görebileceği tarifler: kişiye özel varyasyonları + planlarına eklenmiş tarifler (plan adlarıyla) */
async function visibleRecipeIds(clientId: string) {
  const plans = await prisma.nutritionPlan.findMany({ where: { clientId }, orderBy: { createdAt: 'asc' }, select: { name: true, dataEnc: true } });
  const inPlans = new Map<string, string[]>();
  for (const p of plans) {
    for (const it of decodePlan(p.dataEnc).recipes?.items ?? []) {
      const list = inPlans.get(it.recipeId) ?? [];
      if (!list.includes(p.name)) list.push(p.name);
      inPlans.set(it.recipeId, list);
    }
  }
  const personal = await prisma.recipe.findMany({ where: { clientId }, select: { id: true } });
  return { ids: [...new Set([...inPlans.keys(), ...personal.map((r) => r.id)])], inPlans };
}

const portalSession = (r: { status: string; session: { id: string; title: string; startsAt: Date; endsAt: Date; status: string } }): PortalClassSession => ({
  id: r.session.id,
  title: r.session.title,
  startsAt: r.session.startsAt.toISOString(),
  endsAt: r.session.endsAt.toISOString(),
  status: r.session.status as PortalClassSession['status'],
  myStatus: r.status as PortalClassSession['myStatus'],
});

// ───────────────────────── Özet ─────────────────────────

portalRouter.get('/overview', async (c) => {
  const clientId = portalUser(c).clientId;
  const [next, latestPlan, latestMessage, measurements, planCount, messageCount, fileCount, recipes, nextClass] = await Promise.all([
    prisma.appointment.findFirst({
      where: { clientId, status: { in: ['CONFIRMED', 'PENDING'] }, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: apptSelect,
    }),
    prisma.nutritionPlan.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, createdAt: true, updatedAt: true } }),
    prisma.clientMessage.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, include: messageInclude }),
    prisma.measurement.findMany({ where: { clientId }, orderBy: [{ measuredOn: 'asc' }, { createdAt: 'asc' }], select: { id: true, measuredOn: true, dataEnc: true } }),
    prisma.nutritionPlan.count({ where: { clientId } }),
    prisma.clientMessage.count({ where: { clientId } }),
    prisma.clientFile.count({ where: { clientId, visibleToClient: true } }),
    visibleRecipeIds(clientId),
    prisma.classAttendance.findFirst({
      where: { clientId, status: 'BOOKED', session: { startsAt: { gt: new Date() }, status: 'SCHEDULED' } },
      select: { status: true, session: { select: { id: true, title: true, startsAt: true, endsAt: true, status: true } } },
      orderBy: { session: { startsAt: 'asc' } },
    }),
  ]);
  const ms = measurements.map(toMeasurement);
  const weights = ms.filter((m) => m.weightKg != null);
  const last = weights.at(-1) ?? null;
  const target = [...ms].reverse().find((m) => m.targetWeightKg != null)?.targetWeightKg ?? null;
  const out: PortalOverview = {
    nextAppointment: next ? toAppointment(next) : null,
    nextClass: nextClass ? portalSession(nextClass) : null,
    latestPlan: latestPlan ? toPlanItem(latestPlan) : null,
    latestMessage: latestMessage ? toMessage(latestMessage) : null,
    weight: { current: last?.weightKg ?? null, first: weights[0]?.weightKg ?? null, target, measuredOn: last?.measuredOn ?? null },
    counts: { plans: planCount, recipes: recipes.ids.length, messages: messageCount, files: fileCount },
  };
  return c.json(out);
});

// ───────────────────────── Beslenme listeleri ─────────────────────────

portalRouter.get('/plans', async (c) => {
  const rows = await prisma.nutritionPlan.findMany({
    where: { clientId: portalUser(c).clientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return c.json({ items: rows.map(toPlanItem) });
});

async function loadOwnPlan(c: Ctx) {
  const plan = await prisma.nutritionPlan.findFirst({ where: { id: idParam(c), clientId: portalUser(c).clientId } });
  if (!plan) throw notFound('Liste bulunamadı');
  return plan;
}

portalRouter.get('/plans/:id', async (c) => {
  const plan = await loadOwnPlan(c);
  const { recipes: attached, ...data } = decodePlan(plan.dataEnc);
  const ids = (attached?.items ?? []).map((i) => i.recipeId);
  const rows = ids.length ? await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, contentEnc: true } }) : [];
  const titles = new Map(rows.map((r) => [r.id, decryptContent(r.contentEnc).title]));
  const out: PortalPlan = {
    ...toPlanItem(plan),
    data,
    recipes: (attached?.items ?? []).filter((i) => titles.has(i.recipeId)).map((i) => ({ id: i.recipeId, title: titles.get(i.recipeId)!, label: i.label })),
  };
  return c.json({ plan: out });
});

/** Listenin yazdırma sayfası (A4); danışan tarayıcıdan yazdırır ya da "PDF olarak kaydet" ile indirir */
portalRouter.get('/plans/:id/print', async (c) => {
  const plan = await loadOwnPlan(c);
  const data = decodePlan(plan.dataEnc);
  const page = renderPlanPrintPage(data, data.title, await resolvePlanRecipes(data), { autoPrint: c.req.query('autoprint') === '1' });
  await portalAudit(c, 'portal.plan_print', portalUser(c).accountId, { planId: plan.id });
  return c.html(page.html, 200, { 'Content-Security-Policy': page.csp, 'Cache-Control': 'no-store' });
});

// ───────────────────────── Tarifler ─────────────────────────

const recipeSelect = {
  id: true, contentEnc: true, variantNoteEnc: true, clientId: true, category: true, imageBase: true,
  servings: true, prepMinutes: true, cookMinutes: true, kcal: true,
} as const;

portalRouter.get('/recipes', async (c) => {
  const clientId = portalUser(c).clientId;
  const { ids, inPlans } = await visibleRecipeIds(clientId);
  const rows = ids.length ? await prisma.recipe.findMany({ where: { id: { in: ids } }, select: recipeSelect, orderBy: { createdAt: 'desc' } }) : [];
  const items: PortalRecipeCard[] = rows.map((r) => {
    const rc = decryptContent(r.contentEnc);
    return {
      id: r.id, title: rc.title, category: r.category, summary: rc.summary, dietTags: rc.dietTags, imageBase: r.imageBase,
      personal: r.clientId === clientId, variantNote: decryptNote(r.variantNoteEnc), inPlans: inPlans.get(r.id) ?? [],
    };
  });
  return c.json({ items });
});

portalRouter.get('/recipes/:id', async (c) => {
  const clientId = portalUser(c).clientId;
  const id = idParam(c);
  const { ids, inPlans } = await visibleRecipeIds(clientId);
  if (!ids.includes(id)) throw notFound('Tarif bulunamadı');
  const r = await prisma.recipe.findUnique({ where: { id }, select: recipeSelect });
  if (!r) throw notFound('Tarif bulunamadı');
  const rc = decryptContent(r.contentEnc);
  const out: PortalRecipe = {
    id: r.id, title: rc.title, category: r.category, summary: rc.summary, dietTags: rc.dietTags, imageBase: r.imageBase,
    personal: r.clientId === clientId, variantNote: decryptNote(r.variantNoteEnc), inPlans: inPlans.get(r.id) ?? [],
    servings: r.servings, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, kcal: r.kcal,
    ingredients: rc.ingredients, steps: rc.steps, tip: rc.tip,
  };
  return c.json({ recipe: out });
});

// ───────────────────────── Randevular, ölçümler, mesajlar, dosyalar ─────────────────────────

portalRouter.get('/appointments', async (c) => {
  const rows = await prisma.appointment.findMany({
    where: { clientId: portalUser(c).clientId, startsAt: { not: null } },
    orderBy: { startsAt: 'desc' },
    select: apptSelect,
  });
  return c.json({ items: rows.map(toAppointment) });
});

/** Yanıt bekleyen taleplerim (diyet ve pilates) */
portalRouter.get('/requests', async (c) => {
  const rows = await prisma.appointment.findMany({
    where: { clientId: portalUser(c).clientId, status: { in: ['NEW_REQUEST', 'PENDING'] } },
    select: { id: true, kind: true, status: true, createdAt: true, startsAt: true, pilatesFormat: true, preferredDays: true, preferredDayparts: true, service: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const items: PortalRequest[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status as PortalRequest['status'],
    createdAt: r.createdAt.toISOString(),
    startsAt: r.startsAt?.toISOString() ?? null,
    service: r.service?.title ?? null,
    pilatesFormat: r.pilatesFormat,
    preferredDays: parseDays(r.preferredDays),
    preferredDayparts: parseDayparts(r.preferredDayparts),
  }));
  return c.json({ items });
});

/** Pilates boş yerleri (14 gün): aktif grupların boş kontenjanı ve boş yeri olan dersler — kimin katıldığı dönmez */
portalRouter.get('/pilates/availability', async (c) => {
  portalUser(c);
  const now = new Date();
  const until = new Date(now.getTime() + 14 * 86_400_000);
  const [groups, sessions] = await Promise.all([
    prisma.classGroup.findMany({ where: { isActive: true }, select: { id: true, name: true, capacity: true, _count: { select: { members: true } } }, orderBy: { name: 'asc' } }),
    prisma.classSession.findMany({
      where: { status: 'SCHEDULED', startsAt: { gt: now, lt: until } },
      select: { id: true, title: true, startsAt: true, endsAt: true, capacity: true, attendees: { select: { status: true } } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);
  const out: PortalPilatesAvailability = {
    groups: groups.map((g) => ({ id: g.id, name: g.name, free: Math.max(0, g.capacity - g._count.members) })).filter((g) => g.free > 0),
    sessions: sessions
      .map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), free: Math.max(0, s.capacity - s.attendees.filter((a) => CLASS_SEAT_HOLDING.includes(a.status)).length) }))
      .filter((s) => s.free > 0)
      .slice(0, 20),
  };
  return c.json(out);
});

/** Grup dersleri (pilates): yalnızca danışanın kendi katılımı — diğer katılımcıların bilgisi gösterilmez */
portalRouter.get('/classes', async (c) => {
  const clientId = portalUser(c).clientId;
  const rows = await prisma.classAttendance.findMany({
    where: { clientId },
    include: { session: { select: { id: true, title: true, startsAt: true, endsAt: true, status: true } } },
    orderBy: { session: { startsAt: 'desc' } },
    take: 200,
  });
  const items: PortalClassSession[] = rows.map((r) => ({
    id: r.session.id,
    title: r.session.title,
    startsAt: r.session.startsAt.toISOString(),
    endsAt: r.session.endsAt.toISOString(),
    status: r.session.status,
    myStatus: r.status,
  }));
  return c.json({ items });
});

// ───────────────────────── Pilates ─────────────────────────


/** Gruplarım, derslerim, katılım özeti ve açık taleplerim — diğer katılımcıların bilgisi yer almaz */
portalRouter.get('/pilates', async (c) => {
  const clientId = portalUser(c).clientId;
  const now = new Date();
  const sessionSelect = { id: true, title: true, startsAt: true, endsAt: true, status: true, groupId: true } as const;
  const [memberships, upcoming, past, counts, requests] = await Promise.all([
    prisma.classGroupMember.findMany({
      where: { clientId, group: { isActive: true } },
      select: { group: { select: { id: true, name: true, defaultDurationMinutes: true } } },
      orderBy: { group: { name: 'asc' } },
    }),
    prisma.classAttendance.findMany({
      where: { clientId, session: { startsAt: { gte: now }, status: { not: 'CANCELLED' } } },
      select: { status: true, session: { select: sessionSelect } },
      orderBy: { session: { startsAt: 'asc' } },
      take: 40,
    }),
    prisma.classAttendance.findMany({
      where: { clientId, session: { startsAt: { lt: now } } },
      select: { status: true, session: { select: sessionSelect } },
      orderBy: { session: { startsAt: 'desc' } },
      take: 30,
    }),
    prisma.classAttendance.groupBy({ by: ['status'], where: { clientId, session: { startsAt: { lt: now }, status: { not: 'CANCELLED' } } }, _count: true }),
    prisma.appointment.findMany({
      where: { clientId, kind: 'PILATES', status: { in: ['NEW_REQUEST', 'PENDING'] } },
      select: { id: true, createdAt: true, status: true, pilatesFormat: true, preferredDays: true, preferredDayparts: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  // Grubun haftalık düzeni: danışanın önümüzdeki 4 haftadaki derslerinden (gün + saat)
  const horizon = now.getTime() + 28 * 86_400_000;
  const groups = memberships.map(({ group }) => {
    const seen = new Map<string, { weekday: number; time: string }>();
    for (const u of upcoming) {
      if (u.session.groupId !== group.id || u.session.startsAt.getTime() > horizon || !CLASS_SEAT_HOLDING.includes(u.status as never)) continue;
      const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(u.session.startsAt);
      const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(local.find((p) => p.type === 'weekday')!.value) + 1;
      const time = `${local.find((p) => p.type === 'hour')!.value}:${local.find((p) => p.type === 'minute')!.value}`;
      seen.set(`${wd}-${time}`, { weekday: wd, time });
    }
    const pattern = [...seen.values()].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
    return { id: group.id, name: group.name, durationMinutes: group.defaultDurationMinutes, pattern };
  });
  const count = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const out: PortalPilates = {
    groups,
    upcoming: upcoming.map(portalSession),
    past: past.map(portalSession),
    stats: { attended: count('ATTENDED'), noShow: count('NO_SHOW'), excused: count('EXCUSED') },
    requests: requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      status: r.status as 'NEW_REQUEST' | 'PENDING',
      pilatesFormat: r.pilatesFormat,
      preferredDays: parseDays(r.preferredDays),
      preferredDayparts: parseDayparts(r.preferredDayparts),
    })),
  };
  return c.json(out);
});

/** Danışan hesabından pilates ders talebi: Randevular'a saatsiz yeni talep olarak düşer */
portalRouter.post('/pilates/requests', publicFormLimiter, async (c) => {
  const u = portalUser(c);
  const input = parse(portalPilatesRequestSchema, await body(c));
  const client = await prisma.client.findUniqueOrThrow({ where: { id: u.clientId }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } });
  const open = await prisma.appointment.count({ where: { clientId: client.id, kind: 'PILATES', status: { in: ['NEW_REQUEST', 'PENDING'] } } });
  if (open >= 3) throw new HttpError(409, 'TOO_MANY_REQUESTS', 'Yanıt bekleyen 3 talebiniz var. Yeni talep için önce bunların planlanmasını bekleyin ya da mesaj yazın.');
  const days = [...new Set(input.preferredDays)].sort();
  const parts = DAYPARTS.filter((d) => input.preferredDayparts.includes(d));
  const now = new Date();
  const a = await prisma.appointment.create({
    data: {
      clientId: client.id,
      contactName: `${client.firstName} ${client.lastName}`.trim(),
      contactPhone: client.phone,
      contactEmail: client.email,
      meetingType: 'IN_PERSON',
      kind: 'PILATES',
      pilatesFormat: input.pilatesFormat,
      preferredDays: days.length ? days.join(',') : null,
      preferredDayparts: parts.length ? parts.join(',') : null,
      status: 'NEW_REQUEST',
      source: 'WEBSITE',
      clientMessage: input.message?.trim() || null,
      kvkkNoticeAcceptedAt: now,
      statusHistory: { create: { fromStatus: null, toStatus: 'NEW_REQUEST', note: 'Danışan hesabından pilates talebi' } },
    },
    select: { id: true },
  });
  await portalAudit(c, 'portal.pilates_requested', u.accountId, { appointmentId: a.id, format: input.pilatesFormat });
  await notifyStaff('APPOINTMENT_REQUESTED', {
    title: `Danışan hesabından pilates talebi: ${client.firstName} ${client.lastName}`.trim(),
    body: `${PILATES_FORMAT_LABEL[input.pilatesFormat]} · ${pilatesPreferenceText(days, parts)}`,
    appointmentId: a.id,
    clientId: client.id,
  });
  return c.json({ ok: true, reference: a.id.slice(-6).toUpperCase() }, 201);
});

portalRouter.get('/measurements', async (c) => {
  const rows = await prisma.measurement.findMany({
    where: { clientId: portalUser(c).clientId },
    orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, measuredOn: true, dataEnc: true },
  });
  const profile = await prisma.client.findUnique({ where: { id: portalUser(c).clientId }, select: { sex: true, birthDate: true } });
  return c.json({ items: rows.map(toMeasurement), profile: { sex: profile?.sex ?? null, birthDate: profile?.birthDate ?? null } });
});

portalRouter.get('/messages', async (c) => {
  const rows = await prisma.clientMessage.findMany({ where: { clientId: portalUser(c).clientId }, orderBy: { createdAt: 'desc' }, include: messageInclude });
  return c.json({ items: rows.map(toMessage) });
});

portalRouter.get('/files', async (c) => {
  const rows = await prisma.clientFile.findMany({
    where: { clientId: portalUser(c).clientId, visibleToClient: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  const items: PortalFile[] = rows.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }));
  return c.json({ items });
});

portalRouter.get('/files/:id/download', async (c) => {
  const f = await prisma.clientFile.findFirst({ where: { id: idParam(c), clientId: portalUser(c).clientId, visibleToClient: true } });
  if (!f) throw notFound('Dosya bulunamadı');
  let buf: Buffer;
  try {
    buf = decryptBuffer(await fs.readFile(path.join(PRIVATE_UPLOADS, path.basename(f.storedName))));
  } catch {
    throw notFound('Dosya içeriği okunamadı');
  }
  await portalAudit(c, 'portal.file_downloaded', portalUser(c).accountId, { fileId: f.id });
  const ascii = f.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return sendBuffer(c, buf, {
    'Content-Type': f.mimeType,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
});

portalRouter.all('*', () => {
  throw new HttpError(404, 'NOT_FOUND', 'Uç nokta bulunamadı');
});
