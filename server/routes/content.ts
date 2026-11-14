// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içerik yönetimi: site ayarları, blog, SSS, medya */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, body, conflict, HttpError, notFound, param, parse, query, readUpload, router, validationError } from '../lib/http';
import { audit } from '../lib/audit';
import { authUser, requirePermission } from '../auth/session';
import { PUBLIC_UPLOADS, sniffMime } from '../lib/storage';
import { getSettings, saveSetting } from '../services/settings';
import { SETTINGS_KEYS, settingsSchemas, type SettingsKey } from '../../shared/settings';
import { blogPostSchema, blogStatusSchema, faqSchema, serviceReorderSchema } from '../../shared/schemas';
import { POST_STATUSES } from '../../shared/constants';
import { slugify } from '../../shared/text';
import { deleteSiteImage, processSiteImage, sanitizeImage } from '../services/images';

export const contentRouter = router();
contentRouter.use('*', requirePermission('content:write'));

// ───────────── Site ayarları ─────────────

contentRouter.get('/settings', async (c) => {
  return c.json({ settings: await getSettings(SETTINGS_KEYS) });
});

contentRouter.put('/settings/:key', async (c) => {
  const key = param(c, 'key') as SettingsKey;
  if (!SETTINGS_KEYS.includes(key)) throw notFound('Ayar bulunamadı');
  const result = settingsSchemas[key].safeParse(await body(c));
  if (!result.success) throw validationError(result.error);
  const previous = key === 'media' ? (await getSettings(['media'])).media : null;
  await saveSetting(key, result.data as never, authUser(c).id);
  if (previous) {
    // Değiştirilen/kaldırılan site görsellerinin dosyalarını temizle
    const now = new Set(Object.values(result.data as Record<string, { base: string } | null>).map((v) => v?.base));
    for (const img of Object.values(previous)) if (img && !now.has(img.base)) await deleteSiteImage(img.base);
  }
  await audit(c, 'settings.updated', 'website_setting', key);
  return c.json({ key, value: result.data });
});

// ───────────── Blog ─────────────

function readingMinutes(content: string) {
  return Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
}

async function uniquePostSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || 'yazi';
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const hit = await prisma.blogPost.findFirst({ where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const postListQuery = z.object({
  status: z.enum(POST_STATUSES).optional(),
  categoryId: z.string().max(40).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

contentRouter.get('/categories', async (c) => {
  const items = await prisma.blogCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { posts: true } } } });
  return c.json({ items });
});

contentRouter.get('/posts', async (c) => {
  const q = parse(postListQuery, query(c));
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { OR: [{ title: { contains: q.q } }, { excerpt: { contains: q.q } }] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true, slug: true, title: true, excerpt: true, status: true, expertReviewed: true, publishedAt: true, updatedAt: true,
        coverImageUrl: true, readingMinutes: true, category: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);
  return c.json({ items, total, page: q.page, pageSize: q.pageSize });
});

contentRouter.get('/posts/:id', async (c) => {
  const post = await prisma.blogPost.findUnique({ where: { id: param(c) }, include: { category: true } });
  if (!post) throw notFound('Yazı bulunamadı');
  return c.json({ post });
});

contentRouter.post('/posts', async (c) => {
  const data = parse(blogPostSchema, await body(c));
  const slug = await uniquePostSlug(data.slug || data.title);
  const post = await prisma.blogPost.create({
    data: { ...data, slug, readingMinutes: readingMinutes(data.content), authorId: authUser(c).id, status: 'DRAFT' },
  });
  await audit(c, 'blog.created', 'blog_post', post.id, { title: post.title });
  return c.json({ post }, 201);
});

contentRouter.patch('/posts/:id', async (c) => {
  const existing = await prisma.blogPost.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Yazı bulunamadı');
  const data = parse(blogPostSchema.partial(), await body(c));
  const slug = data.slug !== undefined && data.slug !== existing.slug ? await uniquePostSlug(data.slug, existing.id) : undefined;
  // Yayındaki bir yazının uzman onayı kaldırılırsa yazı yayından alınır
  const unpublish = existing.status === 'PUBLISHED' && data.expertReviewed === false;
  const post = await prisma.blogPost.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(slug ? { slug } : {}),
      ...(data.content !== undefined ? { readingMinutes: readingMinutes(data.content) } : {}),
      ...(unpublish ? { status: 'UNPUBLISHED' as const } : {}),
    },
  });
  await audit(c, 'blog.updated', 'blog_post', post.id, { fields: Object.keys(data), unpublished: unpublish || undefined });
  return c.json({ post });
});

contentRouter.post('/posts/:id/status', async (c) => {
  const { status } = parse(blogStatusSchema, await body(c));
  const existing = await prisma.blogPost.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Yazı bulunamadı');
  if (status === 'PUBLISHED') {
    if (!existing.expertReviewed) throw conflict('EXPERT_REVIEW_REQUIRED', 'Yazı, uzman onayı işaretlenmeden yayınlanamaz.');
    if (!existing.content.trim() || !existing.title.trim()) throw badRequest('Başlık ve içerik olmadan yazı yayınlanamaz.');
  }
  const post = await prisma.blogPost.update({
    where: { id: existing.id },
    data: { status, ...(status === 'PUBLISHED' && !existing.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  await audit(c, `blog.status_${status.toLowerCase()}`, 'blog_post', post.id);
  return c.json({ post });
});

contentRouter.delete('/posts/:id', async (c) => {
  const existing = await prisma.blogPost.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound('Yazı bulunamadı');
  await prisma.blogPost.delete({ where: { id: existing.id } });
  await audit(c, 'blog.deleted', 'blog_post', existing.id, { title: existing.title });
  return c.json({ ok: true });
});

// ───────────── SSS ─────────────

contentRouter.get('/faqs', async (c) => {
  return c.json({ items: await prisma.faq.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }) });
});

contentRouter.post('/faqs', async (c) => {
  const data = parse(faqSchema, await body(c));
  const max = await prisma.faq.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.faq.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  await audit(c, 'faq.created', 'faq', item.id);
  return c.json({ item }, 201);
});

contentRouter.post('/faqs/reorder', async (c) => {
  const { ids } = parse(serviceReorderSchema, await body(c));
  await prisma.$transaction(ids.map((id, i) => prisma.faq.update({ where: { id }, data: { sortOrder: i } })));
  await audit(c, 'faq.reordered', 'faq', null);
  return c.json({ items: await prisma.faq.findMany({ orderBy: { sortOrder: 'asc' } }) });
});

contentRouter.patch('/faqs/:id', async (c) => {
  const existing = await prisma.faq.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound();
  const item = await prisma.faq.update({ where: { id: existing.id }, data: parse(faqSchema.partial(), await body(c)) });
  await audit(c, 'faq.updated', 'faq', item.id);
  return c.json({ item });
});

contentRouter.delete('/faqs/:id', async (c) => {
  const existing = await prisma.faq.findUnique({ where: { id: param(c) } });
  if (!existing) throw notFound();
  await prisma.faq.delete({ where: { id: existing.id } });
  await audit(c, 'faq.deleted', 'faq', existing.id);
  return c.json({ ok: true });
});

// ───────────── Medya (herkese açık görseller) ─────────────

contentRouter.post('/media', async (c) => {
  const file = await readUpload(c, { maxBytes: 5 * 1024 * 1024, tooLarge: new HttpError(413, 'UPLOAD_ERROR', 'Dosya en fazla 5 MB olabilir.') });
  if (!file) throw badRequest('Dosya seçilmedi');
  const mime = sniffMime(file.buffer);
  if (!mime || mime === 'application/pdf') throw badRequest('Yalnızca JPG, PNG, WebP veya AVIF görseller yüklenebilir.');
  // Meta veriler (GPS konumu, cihaz bilgisi) silinir; görsel WebP olarak yeniden kodlanır
  let clean: Buffer;
  try {
    clean = await sanitizeImage(file.buffer);
  } catch {
    throw badRequest('Görsel okunamadı. Farklı bir dosya deneyin.');
  }
  const name = `${crypto.randomBytes(12).toString('hex')}.webp`;
  await fs.writeFile(path.join(PUBLIC_UPLOADS, name), clean, { flag: 'wx' });
  const altField = (await c.req.formData()).get('alt');
  const alt = typeof altField === 'string' ? altField.slice(0, 200) : null;
  const asset = await prisma.mediaAsset.create({
    data: { url: `/uploads/public/${name}`, mimeType: 'image/webp', sizeBytes: clean.length, alt, uploadedById: authUser(c).id },
  });
  await audit(c, 'media.uploaded', 'media_asset', asset.id, { mime, size: file.size });
  return c.json({ id: asset.id, url: asset.url }, 201);
});

// ───────────── Site görselleri (kapak, görüşme alanı, portre) ─────────────

contentRouter.post('/site-images', async (c) => {
  const file = await readUpload(c, { maxBytes: 20 * 1024 * 1024, tooLarge: new HttpError(413, 'UPLOAD_ERROR', 'Dosya en fazla 20 MB olabilir.') });
  if (!file) throw badRequest('Dosya seçilmedi');
  const mime = sniffMime(file.buffer);
  if (!mime || mime === 'application/pdf') throw badRequest('Yalnızca JPG, PNG, WebP veya AVIF fotoğraflar yüklenebilir.');
  let img;
  try {
    img = await processSiteImage(file.buffer);
  } catch (e) {
    if ((e as Error).message === 'TOO_SMALL') throw badRequest('Fotoğraf çok küçük. En az 400×400 piksel olmalı; mümkünse 1600 piksel ve üzeri yükleyin.');
    throw badRequest('Fotoğraf işlenemedi. Farklı bir dosya deneyin.');
  }
  await prisma.mediaAsset.create({
    data: { url: `${img.base}-${img.width}.webp`, mimeType: 'image/webp', sizeBytes: file.size, uploadedById: authUser(c).id },
  });
  await audit(c, 'media.site_image_uploaded', 'media_asset', img.id, { widths: img.widths });
  return c.json({ image: { base: img.base, widths: img.widths, width: img.width, height: img.height } }, 201);
});

contentRouter.get('/media', async (c) => {
  return c.json({ items: await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }) });
});

contentRouter.delete('/media/:id', async (c) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: param(c) } });
  if (!asset) throw notFound();
  const file = path.join(PUBLIC_UPLOADS, path.basename(asset.url));
  await fs.unlink(file).catch(() => {});
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await audit(c, 'media.deleted', 'media_asset', asset.id);
  return c.json({ ok: true });
});
