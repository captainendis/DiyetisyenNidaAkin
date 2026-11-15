// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Bildirim merkezi — her kullanıcı yalnızca kendi bildirimlerini görür. */
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { badRequest, notFound, parse, query, router, type Ctx } from '../lib/http';
import { authUser } from '../auth/session';
import { channelStatus } from '../services/notifications';
import { NOTIFICATION_TYPES } from '../../shared/constants';

export const notificationsRouter = router();

const listQuery = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const select = { id: true, type: true, title: true, body: true, appointmentId: true, clientId: true, readAt: true, createdAt: true } as const;

notificationsRouter.get('/', async (c) => {
  const q = parse(listQuery, query(c));
  const where: Prisma.NotificationWhereInput = { userId: authUser(c).id };
  if (q.filter === 'unread') where.readAt = null;
  if (q.type) where.type = q.type;
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: authUser(c).id, readAt: null } }),
  ]);
  return c.json({ items, total, unread, page: q.page, pageSize: q.pageSize });
});

notificationsRouter.get('/unread-count', async (c) => {
  const count = await prisma.notification.count({ where: { userId: authUser(c).id, readAt: null } });
  return c.json({ count });
});

notificationsRouter.get('/channels', async (c) => {
  return c.json({ channels: await channelStatus() });
});

notificationsRouter.post('/read-all', async (c) => {
  const r = await prisma.notification.updateMany({ where: { userId: authUser(c).id, readAt: null }, data: { readAt: new Date() } });
  return c.json({ ok: true, updated: r.count });
});

function nid(c: Ctx) {
  const id = c.req.param('id');
  if (typeof id !== 'string' || id.length > 40) throw badRequest('Geçersiz kimlik');
  return id;
}

async function setRead(c: Ctx, read: boolean) {
  const r = await prisma.notification.updateMany({ where: { id: nid(c), userId: authUser(c).id }, data: { readAt: read ? new Date() : null } });
  if (!r.count) throw notFound('Bildirim bulunamadı');
}

notificationsRouter.post('/:id/read', async (c) => {
  await setRead(c, true);
  return c.json({ ok: true });
});
notificationsRouter.post('/:id/unread', async (c) => {
  await setRead(c, false);
  return c.json({ ok: true });
});
notificationsRouter.delete('/:id', async (c) => {
  const r = await prisma.notification.deleteMany({ where: { id: nid(c), userId: authUser(c).id } });
  if (!r.count) throw notFound('Bildirim bulunamadı');
  return c.json({ ok: true });
});
