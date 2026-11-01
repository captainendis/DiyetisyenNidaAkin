// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Herkese açık içerik uçları — yalnızca yayınlanmış içerik döner, kişisel veri içermez. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { notFound, parse } from '../lib/http';
import { getSettings } from '../services/settings';
import { PUBLIC_SETTINGS_KEYS } from '../../shared/settings';

export const publicContentRouter = Router();

const publicService = {
  id: true, slug: true, title: true, summary: true, description: true, icon: true, imageUrl: true,
  durationMinutes: true, priceCents: true, showPrice: true, sortOrder: true,
} as const;

function serializeService<T extends { priceCents: number | null; showPrice: boolean }>(s: T) {
  const { priceCents, showPrice, ...rest } = s;
  return { ...rest, priceCents: showPrice ? priceCents : null };
}

publicContentRouter.get('/site', async (_req, res) => {
  const [settings, services, faqs, categories] = await Promise.all([
    getSettings(PUBLIC_SETTINGS_KEYS),
    prisma.service.findMany({ where: { isPublished: true }, orderBy: { sortOrder: 'asc' }, select: publicService }),
    prisma.faq.findMany({ where: { isPublished: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, question: true, answer: true } }),
    prisma.blogCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, name: true } }),
  ]);
  // Panelde yapılan değişiklikler yenilemede hemen görünsün
  res.set('Cache-Control', 'no-cache');
  res.json({ settings, services: services.map(serializeService), faqs, categories });
});

publicContentRouter.get('/services/:slug', async (req, res) => {
  const s = await prisma.service.findFirst({ where: { slug: req.params.slug, isPublished: true }, select: publicService });
  if (!s) throw notFound('Hizmet bulunamadı');
  res.json({ service: serializeService(s) });
});

const listQuery = z.object({
  category: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(9),
});

const postCard = {
  id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, coverImageAlt: true,
  publishedAt: true, readingMinutes: true, category: { select: { slug: true, name: true } },
} as const;

publicContentRouter.get('/blog', async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = {
    status: 'PUBLISHED' as const,
    ...(q.category ? { category: { slug: q.category } } : {}),
  };
  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: postCard,
    }),
  ]);
  res.json({ posts, total, page: q.page, pageSize: q.pageSize });
});

publicContentRouter.get('/blog/:slug', async (req, res) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug: req.params.slug, status: 'PUBLISHED' },
    select: {
      ...postCard,
      content: true, seoTitle: true, metaDescription: true, updatedAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
  });
  if (!post) throw notFound('Yazı bulunamadı');
  const related = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED', id: { not: post.id }, ...(post.category ? { category: { slug: post.category.slug } } : {}) },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: postCard,
  });
  res.json({ post, related });
});
