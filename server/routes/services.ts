// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet yönetimi — ana sayfadaki hizmet kartları buradan yönetilir. */
import { z } from 'zod';
import { prisma } from '../lib/db';
import { body, notFound, param, parse, router } from '../lib/http';
import { audit } from '../lib/audit';
import { requirePermission } from '../auth/session';
import { serviceReorderSchema, serviceSchema } from '../../shared/schemas';
import { slugify } from '../../shared/text';

export const servicesRouter = router();

export async function uniqueServiceSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || 'hizmet';
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const hit = await prisma.service.findFirst({ where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

servicesRouter.get('/', requirePermission('appointments:read'), async (c) => {
  const items = await prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return c.json({ items });
});

servicesRouter.post('/', requirePermission('services:write'), async (c) => {
  const data = parse(serviceSchema, await body(c));
  const slug = await uniqueServiceSlug(data.slug || data.title);
  const max = await prisma.service.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.service.create({ data: { ...data, slug, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  await audit(c, 'service.created', 'service', item.id, { title: item.title });
  return c.json({ item }, 201);
});

servicesRouter.post('/reorder', requirePermission('services:write'), async (c) => {
  const { ids } = parse(serviceReorderSchema, await body(c));
  await prisma.$transaction(ids.map((id, i) => prisma.service.update({ where: { id }, data: { sortOrder: i } })));
  await audit(c, 'service.reordered', 'service', null, { count: ids.length });
  const items = await prisma.service.findMany({ orderBy: { sortOrder: 'asc' } });
  return c.json({ items });
});

servicesRouter.patch('/:id', requirePermission('services:write'), async (c) => {
  const existing = await prisma.service.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  const data = parse(serviceSchema.partial(), await body(c));
  const slug = data.slug !== undefined && data.slug !== existing.slug ? await uniqueServiceSlug(data.slug, existing.id) : undefined;
  const item = await prisma.service.update({ where: { id: existing.id }, data: { ...data, ...(slug ? { slug } : {}) } });
  await audit(c, 'service.updated', 'service', item.id, { fields: Object.keys(data) });
  return c.json({ item });
});

servicesRouter.patch('/:id/visibility', requirePermission('services:write'), async (c) => {
  const { isPublished } = parse(z.object({ isPublished: z.boolean() }), await body(c));
  const existing = await prisma.service.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  const item = await prisma.service.update({ where: { id: existing.id }, data: { isPublished } });
  await audit(c, isPublished ? 'service.published' : 'service.unpublished', 'service', item.id);
  return c.json({ item });
});

servicesRouter.delete('/:id', requirePermission('services:write'), async (c) => {
  const existing = await prisma.service.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  await prisma.service.delete({ where: { id: existing.id } });
  await audit(c, 'service.deleted', 'service', existing.id, { title: existing.title });
  return c.json({ ok: true });
});
