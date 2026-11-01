// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet yönetimi — ana sayfadaki hizmet kartları buradan yönetilir. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { notFound, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { requirePermission } from '../auth/session';
import { serviceReorderSchema, serviceSchema } from '../../shared/schemas';
import { slugify } from '../../shared/text';

export const servicesRouter = Router();

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

servicesRouter.get('/', requirePermission('appointments:read'), async (_req, res) => {
  const items = await prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  res.json({ items });
});

servicesRouter.post('/', requirePermission('services:write'), async (req, res) => {
  const data = parse(serviceSchema, req.body);
  const slug = await uniqueServiceSlug(data.slug || data.title);
  const max = await prisma.service.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.service.create({ data: { ...data, slug, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  await audit(req, 'service.created', 'service', item.id, { title: item.title });
  res.status(201).json({ item });
});

servicesRouter.post('/reorder', requirePermission('services:write'), async (req, res) => {
  const { ids } = parse(serviceReorderSchema, req.body);
  await prisma.$transaction(ids.map((id, i) => prisma.service.update({ where: { id }, data: { sortOrder: i } })));
  await audit(req, 'service.reordered', 'service', null, { count: ids.length });
  const items = await prisma.service.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ items });
});

servicesRouter.patch('/:id', requirePermission('services:write'), async (req, res) => {
  const existing = await prisma.service.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  const data = parse(serviceSchema.partial(), req.body);
  const slug = data.slug !== undefined && data.slug !== existing.slug ? await uniqueServiceSlug(data.slug, existing.id) : undefined;
  const item = await prisma.service.update({ where: { id: existing.id }, data: { ...data, ...(slug ? { slug } : {}) } });
  await audit(req, 'service.updated', 'service', item.id, { fields: Object.keys(data) });
  res.json({ item });
});

servicesRouter.patch('/:id/visibility', requirePermission('services:write'), async (req, res) => {
  const { isPublished } = parse(z.object({ isPublished: z.boolean() }), req.body);
  const existing = await prisma.service.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  const item = await prisma.service.update({ where: { id: existing.id }, data: { isPublished } });
  await audit(req, isPublished ? 'service.published' : 'service.unpublished', 'service', item.id);
  res.json({ item });
});

servicesRouter.delete('/:id', requirePermission('services:write'), async (req, res) => {
  const existing = await prisma.service.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound('Hizmet bulunamadı');
  await prisma.service.delete({ where: { id: existing.id } });
  await audit(req, 'service.deleted', 'service', existing.id, { title: existing.title });
  res.json({ ok: true });
});
