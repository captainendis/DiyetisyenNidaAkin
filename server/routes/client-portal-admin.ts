// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel: danışan hesabı yönetimi ve danışana görünen içerik (/api/clients/:id/...)
 *  - /account   hesap aç, bağlantı üret, e-posta/durum değiştir, kapat — portal:manage (yalnızca yönetici)
 *  - /messages  danışana mesajlar (klinik notlardan ayrı; danışan bunları görür) — clinical:read / clinical:write
 *  - /files/:fileId/visibility  dosyanın danışana görünürlüğü — clinical:write
 */
import { prisma } from '../lib/db';
import { badRequest, body, conflict, HttpError, notFound, parse, router, type Ctx } from '../lib/http';
import { audit } from '../lib/audit';
import { decryptString, encryptString } from '../lib/crypto';
import { authUser, requirePermission } from '../auth/session';
import { accountInfo, staffLinkFor } from '../services/client-accounts';
import { pushToClient } from '../services/push';
import {
  accountCreateSchema,
  accountUpdateSchema,
  clientMessageSchema,
  fileVisibilitySchema,
  type StaffClientMessage,
} from '../../shared/portal';

export const clientPortalAdminRouter = router();

const manage = requirePermission('portal:manage');
const clinicalRead = requirePermission('clinical:read');
const clinicalWrite = requirePermission('clinical:write');

function param(c: Ctx, key: string) {
  const v = c.req.param(key);
  if (typeof v !== 'string' || v.length > 40) throw badRequest('Geçersiz kimlik');
  return v;
}

async function clientOr404(c: Ctx) {
  const client = await prisma.client.findUnique({ where: { id: param(c, 'id') }, select: { id: true, firstName: true, email: true, status: true } });
  if (!client) throw notFound('Danışan bulunamadı');
  return client;
}

async function emailTaken(email: string, exceptAccountId?: string) {
  const a = await prisma.clientAccount.findUnique({ where: { email }, select: { id: true } });
  return !!a && a.id !== exceptAccountId;
}

// ───────────────────────── Hesap ─────────────────────────

clientPortalAdminRouter.get('/account', manage, async (c) => {
  const client = await clientOr404(c);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: client.id } });
  return c.json({ account: a ? await accountInfo(a) : null, suggestedEmail: client.email });
});

clientPortalAdminRouter.post('/account', manage, async (c) => {
  const client = await clientOr404(c);
  if (client.status === 'ARCHIVED') throw new HttpError(409, 'CLIENT_ARCHIVED', 'Arşivlenmiş danışan için hesap açılamaz. Önce durumunu güncelleyin.');
  const { email } = parse(accountCreateSchema, await body(c));
  if (await prisma.clientAccount.findUnique({ where: { clientId: client.id }, select: { id: true } })) throw conflict('ACCOUNT_EXISTS', 'Bu danışanın zaten bir hesabı var');
  if (await emailTaken(email)) throw conflict('EMAIL_TAKEN', 'Bu e-posta başka bir danışan hesabında kullanılıyor', { fields: { email: 'Bu e-posta başka bir hesapta kullanılıyor' } });
  const a = await prisma.clientAccount.create({ data: { clientId: client.id, email, createdById: authUser(c).id } });
  const link = await staffLinkFor(a, client.firstName);
  await audit(c, 'portal_account.created', 'client', client.id, { accountId: a.id, emailed: link.emailed });
  return c.json({ account: await accountInfo(a), link }, 201);
});

/** Yeni bağlantı: etkinleştirilmemişse etkinleştirme, etkinse şifre sıfırlama bağlantısı (öncekiler geçersiz olur) */
clientPortalAdminRouter.post('/account/link', manage, async (c) => {
  const client = await clientOr404(c);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: client.id } });
  if (!a) throw notFound('Bu danışanın hesabı yok');
  if (!a.isActive) throw new HttpError(409, 'ACCOUNT_INACTIVE', 'Hesap kapalı. Bağlantı üretmek için önce hesabı açın.');
  const link = await staffLinkFor(a, client.firstName);
  await audit(c, 'portal_account.link_issued', 'client', client.id, { accountId: a.id, purpose: link.purpose, emailed: link.emailed });
  return c.json({ account: await accountInfo(a), link });
});

clientPortalAdminRouter.patch('/account', manage, async (c) => {
  const client = await clientOr404(c);
  const a = await prisma.clientAccount.findUnique({ where: { clientId: client.id } });
  if (!a) throw notFound('Bu danışanın hesabı yok');
  const input = parse(accountUpdateSchema, await body(c));
  if (input.email && input.email !== a.email && (await emailTaken(input.email, a.id))) {
    throw conflict('EMAIL_TAKEN', 'Bu e-posta başka bir danışan hesabında kullanılıyor', { fields: { email: 'Bu e-posta başka bir hesapta kullanılıyor' } });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.clientAccount.update({ where: { id: a.id }, data: input });
    // Kapatılan hesabın açık oturumları hemen düşer
    if (input.isActive === false) {
      await tx.clientSession.deleteMany({ where: { accountId: a.id } });
      await tx.pushDevice.deleteMany({ where: { clientAccountId: a.id } });
    }
    return u;
  });
  const action = input.isActive === false ? 'portal_account.deactivated' : input.isActive === true && !a.isActive ? 'portal_account.activated' : 'portal_account.updated';
  await audit(c, action, 'client', client.id, { accountId: a.id, fields: Object.keys(input) });
  return c.json({ account: await accountInfo(updated) });
});

clientPortalAdminRouter.delete('/account', manage, async (c) => {
  const client = await clientOr404(c);
  const r = await prisma.clientAccount.deleteMany({ where: { clientId: client.id } }); // oturumlar ve bağlantılar cascade
  if (!r.count) throw notFound('Bu danışanın hesabı yok');
  await audit(c, 'portal_account.deleted', 'client', client.id);
  return c.json({ ok: true });
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

clientPortalAdminRouter.get('/messages', clinicalRead, async (c) => {
  const client = await clientOr404(c);
  const rows = await prisma.clientMessage.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, include: msgInclude });
  return c.json({ items: rows.map(serialize) });
});

clientPortalAdminRouter.post('/messages', clinicalWrite, async (c) => {
  const client = await clientOr404(c);
  const input = parse(clientMessageSchema, await body(c));
  const m = await prisma.clientMessage.create({
    data: { clientId: client.id, appointmentId: await validAppointment(client.id, input.appointmentId), authorId: authUser(c).id, contentEnc: encryptString(input.content) },
    include: msgInclude,
  });
  await audit(c, 'client_message.created', 'client', client.id, { messageId: m.id });
  // Mesaj metni bildirime yazılmaz (kilit ekranında görünebilir)
  pushToClient(client.id, { title: 'Diyetisyeninden yeni mesaj', body: 'Okumak için dokun.', url: '/hesabim/mesajlar', data: { type: 'CLIENT_MESSAGE' } });
  return c.json({ message: serialize(m) }, 201);
});

clientPortalAdminRouter.patch('/messages/:messageId', clinicalWrite, async (c) => {
  const client = await clientOr404(c);
  const id = param(c, 'messageId');
  const input = parse(clientMessageSchema, await body(c));
  const exists = await prisma.clientMessage.findFirst({ where: { id, clientId: client.id }, select: { id: true } });
  if (!exists) throw notFound('Mesaj bulunamadı');
  const m = await prisma.clientMessage.update({
    where: { id },
    data: { contentEnc: encryptString(input.content), appointmentId: await validAppointment(client.id, input.appointmentId) },
    include: msgInclude,
  });
  await audit(c, 'client_message.updated', 'client', client.id, { messageId: id });
  return c.json({ message: serialize(m) });
});

clientPortalAdminRouter.delete('/messages/:messageId', clinicalWrite, async (c) => {
  const client = await clientOr404(c);
  const id = param(c, 'messageId');
  const r = await prisma.clientMessage.deleteMany({ where: { id, clientId: client.id } });
  if (!r.count) throw notFound('Mesaj bulunamadı');
  await audit(c, 'client_message.deleted', 'client', client.id, { messageId: id });
  return c.json({ ok: true });
});

// ───────────────────────── Dosya görünürlüğü ─────────────────────────

clientPortalAdminRouter.patch('/files/:fileId/visibility', clinicalWrite, async (c) => {
  const client = await clientOr404(c);
  const fileId = param(c, 'fileId');
  const { visibleToClient } = parse(fileVisibilitySchema, await body(c));
  const r = await prisma.clientFile.updateMany({ where: { id: fileId, clientId: client.id }, data: { visibleToClient } });
  if (!r.count) throw notFound('Dosya bulunamadı');
  await audit(c, visibleToClient ? 'clinical.file_shared' : 'clinical.file_hidden', 'client', client.id, { fileId });
  return c.json({ ok: true, visibleToClient });
});
