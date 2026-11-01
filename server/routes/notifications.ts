// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Bildirim merkezi — her kullanıcı yalnızca kendi bildirimlerini görür. */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { badRequest, notFound, parse } from '../lib/http';
import { channelStatus } from '../services/notifications';
import { NOTIFICATION_TYPES } from '../../shared/constants';

export const notificationsRouter = Router();

const listQuery = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const select = { id: true, type: true, title: true, body: true, appointmentId: true, clientId: true, readAt: true, createdAt: true } as const;

notificationsRouter.get('/', async (req, res) => {
  const q = parse(listQuery, req.query);
  const where: Prisma.NotificationWhereInput = { userId: req.user!.id };
  if (q.filter === 'unread') where.readAt = null;
  if (q.type) where.type = q.type;
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  res.json({ items, total, unread, page: q.page, pageSize: q.pageSize });
});

notificationsRouter.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
  res.json({ count });
});

notificationsRouter.get('/channels', (_req, res) => {
  res.json({ channels: channelStatus() });
});

notificationsRouter.post('/read-all', async (req, res) => {
  const r = await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true, updated: r.count });
});

function nid(req: Request) {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length > 40) throw badRequest('Geçersiz kimlik');
  return id;
}

async function setRead(req: Request, read: boolean) {
  const r = await prisma.notification.updateMany({ where: { id: nid(req), userId: req.user!.id }, data: { readAt: read ? new Date() : null } });
  if (!r.count) throw notFound('Bildirim bulunamadı');
}

notificationsRouter.post('/:id/read', async (req, res) => {
  await setRead(req, true);
  res.json({ ok: true });
});
notificationsRouter.post('/:id/unread', async (req, res) => {
  await setRead(req, false);
  res.json({ ok: true });
});
notificationsRouter.delete('/:id', async (req, res) => {
  const r = await prisma.notification.deleteMany({ where: { id: nid(req), userId: req.user!.id } });
  if (!r.count) throw notFound('Bildirim bulunamadı');
  res.json({ ok: true });
});
