// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { z } from 'zod';
import { prisma } from '../lib/db';
import { parse, query, router } from '../lib/http';
import { requirePermission } from '../auth/session';
import { dateStr } from '../../shared/schemas';
import { startOfDay, endOfDayExclusive } from '../../shared/time';

export const auditRouter = router();

const listQuery = z.object({
  action: z.string().max(80).optional(),
  entityType: z.string().max(60).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

auditRouter.get('/', requirePermission('audit:read'), async (c) => {
  const q = parse(listQuery, query(c));
  const where = {
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: startOfDay(q.from) } : {}), ...(q.to ? { lt: endOfDayExclusive(q.to) } : {}) } }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);
  return c.json({ items: items.map(({ userId: _u, ...r }) => r), total, page: q.page, pageSize: q.pageSize });
});

auditRouter.get('/facets', requirePermission('audit:read'), async (c) => {
  const [actions, types] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, take: 200 }),
    prisma.auditLog.findMany({ distinct: ['entityType'], select: { entityType: true }, take: 100 }),
  ]);
  return c.json({ actions: actions.map((a) => a.action).sort(), entityTypes: types.map((t) => t.entityType).sort() });
});
