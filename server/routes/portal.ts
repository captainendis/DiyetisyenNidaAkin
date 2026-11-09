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
import { Router, type Request } from 'express';
import { prisma } from '../lib/db';
import { burnPasswordCheck, decryptBuffer, decryptJson, decryptString, hashPassword, sha256, verifyPassword } from '../lib/crypto';
import { HttpError, badRequest, notFound, parse, unauthorized } from '../lib/http';
import { audit } from '../lib/audit';
import { PRIVATE_UPLOADS } from '../lib/storage';
import { loginLimiter, passwordResetLimiter } from '../middleware/rate-limit';
import { createClientSession, destroyClientSession, loadClientSession, requireClientAuth } from '../auth/client-session';
import { emailAccountLink, issueAccountLink } from '../services/client-accounts';
import { isEmailConfigured } from '../services/mailer';
import { decryptContent } from '../services/recipe-content';
import { decryptNote } from '../services/recipe-notes';
import { PdfUnavailableError, renderPlanPdf } from '../services/pdf';
import { decodePlan } from './plans';
import { resolvePlanRecipes } from './recipes';
import { slugify } from '../../shared/text';
import { todayStr } from '../../shared/time';
import {
  portalChangePasswordSchema,
  portalForgotSchema,
  portalLoginSchema,
  portalSetPasswordSchema,
  portalTokenQuerySchema,
  type PortalAppointment,
  type PortalFile,
  type PortalMeasurement,
  type PortalMessage,
  type PortalOverview,
  type PortalPlan,
  type PortalPlanListItem,
  type PortalRecipe,
  type PortalRecipeCard,
} from '../../shared/portal';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const portalRouter = Router();
portalRouter.use(loadClientSession);

/** Danışan eylemleri için denetim kaydı: personel kullanıcısı yok, kim olduğu metadata'da */
function portalAudit(req: Request, action: string, accountId: string | null, meta: Record<string, unknown> = {}) {
  return audit(req, action, 'client_account', accountId, { actor: 'client', ...meta });
}

function idParam(req: Request, key = 'id') {
  const v = req.params[key];
  if (typeof v !== 'string' || v.length > 40) throw badRequest('Geçersiz kimlik');
  return v;
}

// ───────────────────────── Kimlik ─────────────────────────

portalRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password, remember } = parse(portalLoginSchema, req.body);
  const account = await prisma.clientAccount.findUnique({ where: { email }, include: { client: { select: { status: true } } } });
  const generic = new HttpError(401, 'INVALID_CREDENTIALS', 'E-posta adresi veya şifre hatalı');

  if (!account || !account.isActive || !account.passwordHash || account.client.status === 'ARCHIVED') {
    await burnPasswordCheck(password);
    await portalAudit(req, 'portal.login_failed', account?.id ?? null, { reason: account ? 'inactive_or_not_activated' : 'unknown' });
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
    await portalAudit(req, lock ? 'portal.account_locked' : 'portal.login_failed', account.id);
    throw generic;
  }
  await prisma.clientAccount.update({ where: { id: account.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createClientSession(req, res, account.id, remember);
  await portalAudit(req, 'portal.login', account.id, { remember });
  res.json({ ok: true });
});

portalRouter.post('/auth/logout', async (req, res) => {
  if (req.portalUser) await portalAudit(req, 'portal.logout', req.portalUser.accountId);
  await destroyClientSession(req, res);
  res.json({ ok: true });
});

portalRouter.get('/auth/me', (req, res) => {
  const u = req.portalUser;
  if (!u) throw unauthorized();
  res.json({ me: { firstName: u.firstName, lastName: u.lastName, email: u.email, csrfToken: u.csrfToken } });
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
portalRouter.get('/auth/token', passwordResetLimiter, async (req, res) => {
  const { token } = parse(portalTokenQuerySchema, req.query);
  const t = await findValidToken(token);
  res.json({ purpose: t.purpose, firstName: t.account.client.firstName, email: t.account.email });
});

/** Etkinleştirme ya da sıfırlama: şifreyi belirler, eski oturumları kapatır ve danışanı oturum açmış hâle getirir */
portalRouter.post('/auth/set-password', passwordResetLimiter, async (req, res) => {
  const { token, password } = parse(portalSetPasswordSchema, req.body);
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
  await createClientSession(req, res, t.accountId, false);
  await portalAudit(req, t.purpose === 'ACTIVATE' ? 'portal.activated' : 'portal.password_reset', t.accountId);
  res.json({ ok: true });
});

portalRouter.post('/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  const { email } = parse(portalForgotSchema, req.body);
  const configured = isEmailConfigured();
  const response = {
    ok: true,
    emailConfigured: configured,
    message: configured
      ? 'Bu adrese kayıtlı bir danışan hesabı varsa şifre sıfırlama bağlantısı gönderildi.'
      : 'Şifrenizi sıfırlamak için diyetisyeninizle iletişime geçin; size yeni bir giriş bağlantısı gönderebilir.',
  };
  if (!configured) return res.json(response);
  const account = await prisma.clientAccount.findUnique({ where: { email }, include: { client: { select: { firstName: true, status: true } } } });
  // Hesabın varlığı yanıttan anlaşılmamalı
  if (!account || !account.isActive || !account.passwordHash || account.client.status === 'ARCHIVED') return res.json(response);
  const { link } = await issueAccountLink(account.id, 'RESET');
  await emailAccountLink(account.email, account.client.firstName, 'RESET', link);
  await portalAudit(req, 'portal.password_reset_requested', account.id);
  res.json(response);
});

// ── Bundan sonraki her uç danışan oturumu gerektirir ──
portalRouter.use(requireClientAuth);

portalRouter.post('/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = parse(portalChangePasswordSchema, req.body);
  const u = req.portalUser!;
  const account = await prisma.clientAccount.findUniqueOrThrow({ where: { id: u.accountId } });
  if (!account.passwordHash || !(await verifyPassword(currentPassword, account.passwordHash))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Mevcut şifre hatalı', { fields: { currentPassword: 'Mevcut şifre hatalı' } });
  }
  const changedAt = new Date(Date.now() - 1000); // bkz. set-password
  await prisma.$transaction([
    prisma.clientAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: changedAt } }),
    prisma.clientSession.deleteMany({ where: { accountId: account.id } }),
  ]);
  await createClientSession(req, res, account.id, false);
  await portalAudit(req, 'portal.password_changed', account.id);
  res.json({ ok: true });
});

// ───────────────────────── Yardımcılar ─────────────────────────

const apptSelect = {
  id: true, startsAt: true, endsAt: true, status: true, meetingType: true, service: { select: { title: true } },
} as const;

function toAppointment(a: { id: string; startsAt: Date | null; endsAt: Date | null; status: PortalAppointment['status']; meetingType: PortalAppointment['meetingType']; service: { title: string } | null }): PortalAppointment {
  return {
    id: a.id,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    status: a.status,
    meetingType: a.meetingType,
    service: a.service?.title ?? null,
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
  let d: { heightCm?: number | null; weightKg?: number | null; targetWeightKg?: number | null } = {};
  try {
    d = decryptJson(m.dataEnc);
  } catch {
    /* çözülemeyen ölçüm boş gösterilir */
  }
  return { id: m.id, measuredOn: m.measuredOn, heightCm: d.heightCm ?? null, weightKg: d.weightKg ?? null, targetWeightKg: d.targetWeightKg ?? null };
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

// ───────────────────────── Özet ─────────────────────────

portalRouter.get('/overview', async (req, res) => {
  const clientId = req.portalUser!.clientId;
  const [next, latestPlan, latestMessage, measurements, planCount, messageCount, fileCount, recipes] = await Promise.all([
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
  ]);
  const ms = measurements.map(toMeasurement);
  const weights = ms.filter((m) => m.weightKg != null);
  const last = weights.at(-1) ?? null;
  const target = [...ms].reverse().find((m) => m.targetWeightKg != null)?.targetWeightKg ?? null;
  const out: PortalOverview = {
    nextAppointment: next ? toAppointment(next) : null,
    latestPlan: latestPlan ? toPlanItem(latestPlan) : null,
    latestMessage: latestMessage ? toMessage(latestMessage) : null,
    weight: { current: last?.weightKg ?? null, first: weights[0]?.weightKg ?? null, target, measuredOn: last?.measuredOn ?? null },
    counts: { plans: planCount, recipes: recipes.ids.length, messages: messageCount, files: fileCount },
  };
  res.json(out);
});

// ───────────────────────── Beslenme listeleri ─────────────────────────

portalRouter.get('/plans', async (req, res) => {
  const rows = await prisma.nutritionPlan.findMany({
    where: { clientId: req.portalUser!.clientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  res.json({ items: rows.map(toPlanItem) });
});

async function loadOwnPlan(req: Request) {
  const plan = await prisma.nutritionPlan.findFirst({ where: { id: idParam(req), clientId: req.portalUser!.clientId } });
  if (!plan) throw notFound('Liste bulunamadı');
  return plan;
}

portalRouter.get('/plans/:id', async (req, res) => {
  const plan = await loadOwnPlan(req);
  const { recipes: attached, ...data } = decodePlan(plan.dataEnc);
  const ids = (attached?.items ?? []).map((i) => i.recipeId);
  const rows = ids.length ? await prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, contentEnc: true } }) : [];
  const titles = new Map(rows.map((r) => [r.id, decryptContent(r.contentEnc).title]));
  const out: PortalPlan = {
    ...toPlanItem(plan),
    data,
    recipes: (attached?.items ?? []).filter((i) => titles.has(i.recipeId)).map((i) => ({ id: i.recipeId, title: titles.get(i.recipeId)!, label: i.label })),
  };
  res.json({ plan: out });
});

portalRouter.get('/plans/:id/pdf', async (req, res) => {
  const plan = await loadOwnPlan(req);
  const data = decodePlan(plan.dataEnc);
  let out;
  try {
    out = await renderPlanPdf(data, data.title, await resolvePlanRecipes(data));
  } catch (e) {
    if (e instanceof PdfUnavailableError) throw new HttpError(503, 'PDF_UNAVAILABLE', 'PDF şu anda hazırlanamıyor. Lütfen biraz sonra tekrar deneyin.');
    throw e;
  }
  await portalAudit(req, 'portal.plan_pdf', req.portalUser!.accountId, { planId: plan.id });
  const file = `Beslenme-Listesi-${slugify(plan.name) || 'liste'}-${todayStr()}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${file}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(out.pdf));
});

// ───────────────────────── Tarifler ─────────────────────────

const recipeSelect = {
  id: true, contentEnc: true, variantNoteEnc: true, clientId: true, category: true, imageBase: true,
  servings: true, prepMinutes: true, cookMinutes: true, kcal: true,
} as const;

portalRouter.get('/recipes', async (req, res) => {
  const clientId = req.portalUser!.clientId;
  const { ids, inPlans } = await visibleRecipeIds(clientId);
  const rows = ids.length ? await prisma.recipe.findMany({ where: { id: { in: ids } }, select: recipeSelect, orderBy: { createdAt: 'desc' } }) : [];
  const items: PortalRecipeCard[] = rows.map((r) => {
    const c = decryptContent(r.contentEnc);
    return {
      id: r.id, title: c.title, category: r.category, summary: c.summary, imageBase: r.imageBase,
      personal: r.clientId === clientId, variantNote: decryptNote(r.variantNoteEnc), inPlans: inPlans.get(r.id) ?? [],
    };
  });
  res.json({ items });
});

portalRouter.get('/recipes/:id', async (req, res) => {
  const clientId = req.portalUser!.clientId;
  const id = idParam(req);
  const { ids, inPlans } = await visibleRecipeIds(clientId);
  if (!ids.includes(id)) throw notFound('Tarif bulunamadı');
  const r = await prisma.recipe.findUnique({ where: { id }, select: recipeSelect });
  if (!r) throw notFound('Tarif bulunamadı');
  const c = decryptContent(r.contentEnc);
  const out: PortalRecipe = {
    id: r.id, title: c.title, category: r.category, summary: c.summary, imageBase: r.imageBase,
    personal: r.clientId === clientId, variantNote: decryptNote(r.variantNoteEnc), inPlans: inPlans.get(r.id) ?? [],
    servings: r.servings, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, kcal: r.kcal,
    ingredients: c.ingredients, steps: c.steps, tip: c.tip,
  };
  res.json({ recipe: out });
});

// ───────────────────────── Randevular, ölçümler, mesajlar, dosyalar ─────────────────────────

portalRouter.get('/appointments', async (req, res) => {
  const rows = await prisma.appointment.findMany({
    where: { clientId: req.portalUser!.clientId, startsAt: { not: null } },
    orderBy: { startsAt: 'desc' },
    select: apptSelect,
  });
  res.json({ items: rows.map(toAppointment) });
});

portalRouter.get('/measurements', async (req, res) => {
  const rows = await prisma.measurement.findMany({
    where: { clientId: req.portalUser!.clientId },
    orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, measuredOn: true, dataEnc: true },
  });
  res.json({ items: rows.map(toMeasurement) });
});

portalRouter.get('/messages', async (req, res) => {
  const rows = await prisma.clientMessage.findMany({ where: { clientId: req.portalUser!.clientId }, orderBy: { createdAt: 'desc' }, include: messageInclude });
  res.json({ items: rows.map(toMessage) });
});

portalRouter.get('/files', async (req, res) => {
  const rows = await prisma.clientFile.findMany({
    where: { clientId: req.portalUser!.clientId, visibleToClient: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  const items: PortalFile[] = rows.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }));
  res.json({ items });
});

portalRouter.get('/files/:id/download', async (req, res) => {
  const f = await prisma.clientFile.findFirst({ where: { id: idParam(req), clientId: req.portalUser!.clientId, visibleToClient: true } });
  if (!f) throw notFound('Dosya bulunamadı');
  let buf: Buffer;
  try {
    buf = decryptBuffer(await fs.readFile(path.join(PRIVATE_UPLOADS, path.basename(f.storedName))));
  } catch {
    throw notFound('Dosya içeriği okunamadı');
  }
  await portalAudit(req, 'portal.file_downloaded', req.portalUser!.accountId, { fileId: f.id });
  const ascii = f.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.set({
    'Content-Type': f.mimeType,
    'Content-Length': String(buf.length),
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(buf);
});

portalRouter.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Uç nokta bulunamadı')));
