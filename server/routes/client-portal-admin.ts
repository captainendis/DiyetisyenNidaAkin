// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel: danışan hesabı yönetimi ve danışana görünen içerik (/api/clients/:id/...)
 *  - /account   hesap aç, bağlantı üret, e-posta/durum değiştir, kapat — portal:manage (yalnızca yönetici)
 *  - /messages  danışana mesajlar (klinik notlardan ayrı; danışan bunları görür) — clinical:read / clinical:write
 *  - /files/:fileId/visibility  dosyanın danışana görünürlüğü — clinical:write
 */
import { Router, type Request } from 'express';
import { prisma } from '../lib/db';
import { badRequest, conflict, HttpError, notFound, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { decryptString, encryptString } from '../lib/crypto';
import { requirePermission } from '../auth/session';
import { accountInfo, staffLinkFor } from '../services/client-accounts';
import {
  accountCreateSchema,
  accountUpdateSchema,
  clientMessageSchema,
  fileVisibilitySchema,
  type StaffClientMessage,
} from '../../shared/portal';

export const clientPortalAdminRouter = Router({ mergeParams: true });

const manage = requirePermission('portal:manage');
const clinicalRead = requirePermission('clinical:read');
const clinicalWrite = requirePermission('clinical:write');

function param(req: Request, key: string) {
  const v = (req.params as Record<string, string | undefined>)[key];
  if (typeof v !== 'string' || v.length > 40) throw badRequest('Geçersiz kimlik');
  return v;
}

async function clientOr404(req: Request) {
  const c = await prisma.client.findUnique({ where: { id: param(req, 'id') }, select: { id: true, firstName: true, email: true, status: true } });
  if (!c) throw notFound('Danışan bulunamadı');
  return c;
}

async function emailTaken(email: string, exceptAccountId?: string) {
  const a = await prisma.clientAccount.findUnique({ where: { email }, select: { id: true } });
  return !!a && a.id !== exceptAccountId;
}

// ───────────────────────── Hesap ─────────────────────────

clientPortalAdminRouter.get('/account', manage, async (req, res) => {
  const c = await clientOr404(req);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: c.id } });
  res.json({ account: a ? await accountInfo(a) : null, suggestedEmail: c.email });
});

clientPortalAdminRouter.post('/account', manage, async (req, res) => {
  const c = await clientOr404(req);
  if (c.status === 'ARCHIVED') throw new HttpError(409, 'CLIENT_ARCHIVED', 'Arşivlenmiş danışan için hesap açılamaz. Önce durumunu güncelleyin.');
  const { email } = parse(accountCreateSchema, req.body);
  if (await prisma.clientAccount.findUnique({ where: { clientId: c.id }, select: { id: true } })) throw conflict('ACCOUNT_EXISTS', 'Bu danışanın zaten bir hesabı var');
  if (await emailTaken(email)) throw conflict('EMAIL_TAKEN', 'Bu e-posta başka bir danışan hesabında kullanılıyor', { fields: { email: 'Bu e-posta başka bir hesapta kullanılıyor' } });
  const a = await prisma.clientAccount.create({ data: { clientId: c.id, email, createdById: req.user!.id } });
  const link = await staffLinkFor(a, c.firstName);
  await audit(req, 'portal_account.created', 'client', c.id, { accountId: a.id, emailed: link.emailed });
  res.status(201).json({ account: await accountInfo(a), link });
});

/** Yeni bağlantı: etkinleştirilmemişse etkinleştirme, etkinse şifre sıfırlama bağlantısı (öncekiler geçersiz olur) */
clientPortalAdminRouter.post('/account/link', manage, async (req, res) => {
  const c = await clientOr404(req);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: c.id } });
  if (!a) throw notFound('Bu danışanın hesabı yok');
  if (!a.isActive) throw new HttpError(409, 'ACCOUNT_INACTIVE', 'Hesap kapalı. Bağlantı üretmek için önce hesabı açın.');
  const link = await staffLinkFor(a, c.firstName);
  await audit(req, 'portal_account.link_issued', 'client', c.id, { accountId: a.id, purpose: link.purpose, emailed: link.emailed });
  res.json({ account: await accountInfo(a), link });
});

clientPortalAdminRouter.patch('/account', manage, async (req, res) => {
  const c = await clientOr404(req);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: c.id } });
  if (!a) throw notFound('Bu danışanın hesabı yok');
  const body = parse(accountUpdateSchema, req.body);
  if (body.email && body.email !== a.email && (await emailTaken(body.email, a.id))) {
    throw conflict('EMAIL_TAKEN', 'Bu e-posta başka bir danışan hesabında kullanılıyor', { fields: { email: 'Bu e-posta başka bir hesapta kullanılıyor' } });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.clientAccount.update({ where: { id: a.id }, data: body });
    // Kapatılan hesabın açık oturumları hemen düşer
    if (body.isActive === false) await tx.clientSession.deleteMany({ where: { accountId: a.id } });
    return u;
  });
  const action = body.isActive === false ? 'portal_account.deactivated' : body.isActive === true && !a.isActive ? 'portal_account.activated' : 'portal_account.updated';
  await audit(req, action, 'client', c.id, { accountId: a.id, fields: Object.keys(body) });
  res.json({ account: await accountInfo(updated) });
});

clientPortalAdminRouter.delete('/account', manage, async (req, res) => {
  const c = await clientOr404(req);
  const r = await prisma.clientAccount.deleteMany({ where: { clientId: c.id } }); // oturumlar ve bağlantılar cascade
  if (!r.count) throw notFound('Bu danışanın hesabı yok');
  await audit(req, 'portal_account.deleted', 'client', c.id);
  res.json({ ok: true });
});

// ───────────────────────── Danışana mesajlar ─────────────────────────

const msgInclude = {
  author: { select: { firstName: true, lastName: true } },
  appointment: { select: { startsAt: true } },
} as const;

function serialize(m: { id: string; contentEnc: string; appointmentId: string | null; createdAt: Date; updatedAt: Date; author: { firstName: string; lastName: string } | null; appointment: { startsAt: Date | null } | null }): StaffClientMessage {
  let content = '';
  try {
    content = decryptString(m.contentEnc);
  } catch {
    content = '[Bu mesaj çözülemedi — şifreleme anahtarını kontrol edin]';
  }
  return {
    id: m.id,
    content,
    appointmentId: m.appointmentId,
    appointmentAt: m.appointment?.startsAt?.toISOString() ?? null,
    author: m.author,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

async function validAppointment(clientId: string, appointmentId: string | null | undefined) {
  if (!appointmentId) return null;
  const a = await prisma.appointment.findFirst({ where: { id: appointmentId, clientId }, select: { id: true } });
  if (!a) throw new HttpError(422, 'VALIDATION_ERROR', 'Randevu bu danışana ait değil', { fields: { appointmentId: 'Geçersiz randevu' } });
  return a.id;
}

clientPortalAdminRouter.get('/messages', clinicalRead, async (req, res) => {
  const c = await clientOr404(req);
  const rows = await prisma.clientMessage.findMany({ where: { clientId: c.id }, orderBy: { createdAt: 'desc' }, include: msgInclude });
  res.json({ items: rows.map(serialize) });
});

clientPortalAdminRouter.post('/messages', clinicalWrite, async (req, res) => {
  const c = await clientOr404(req);
  const body = parse(clientMessageSchema, req.body);
  const m = await prisma.clientMessage.create({
    data: { clientId: c.id, appointmentId: await validAppointment(c.id, body.appointmentId), authorId: req.user!.id, contentEnc: encryptString(body.content) },
    include: msgInclude,
  });
  await audit(req, 'client_message.created', 'client', c.id, { messageId: m.id });
  res.status(201).json({ message: serialize(m) });
});

clientPortalAdminRouter.patch('/messages/:messageId', clinicalWrite, async (req, res) => {
  const c = await clientOr404(req);
  const id = param(req, 'messageId');
  const body = parse(clientMessageSchema, req.body);
  const exists = await prisma.clientMessage.findFirst({ where: { id, clientId: c.id }, select: { id: true } });
  if (!exists) throw notFound('Mesaj bulunamadı');
  const m = await prisma.clientMessage.update({
    where: { id },
    data: { contentEnc: encryptString(body.content), appointmentId: await validAppointment(c.id, body.appointmentId) },
    include: msgInclude,
  });
  await audit(req, 'client_message.updated', 'client', c.id, { messageId: id });
  res.json({ message: serialize(m) });
});

clientPortalAdminRouter.delete('/messages/:messageId', clinicalWrite, async (req, res) => {
  const c = await clientOr404(req);
  const id = param(req, 'messageId');
  const r = await prisma.clientMessage.deleteMany({ where: { id, clientId: c.id } });
  if (!r.count) throw notFound('Mesaj bulunamadı');
  await audit(req, 'client_message.deleted', 'client', c.id, { messageId: id });
  res.json({ ok: true });
});

// ───────────────────────── Dosya görünürlüğü ─────────────────────────

clientPortalAdminRouter.patch('/files/:fileId/visibility', clinicalWrite, async (req, res) => {
  const c = await clientOr404(req);
  const fileId = param(req, 'fileId');
  const { visibleToClient } = parse(fileVisibilitySchema, req.body);
  const r = await prisma.clientFile.updateMany({ where: { id: fileId, clientId: c.id }, data: { visibleToClient } });
  if (!r.count) throw notFound('Dosya bulunamadı');
  await audit(req, visibleToClient ? 'clinical.file_shared' : 'clinical.file_hidden', 'client', c.id, { fileId });
  res.json({ ok: true, visibleToClient });
});
