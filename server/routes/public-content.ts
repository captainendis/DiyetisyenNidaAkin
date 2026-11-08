// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Herkese açık içerik uçları — yalnızca yayınlanmış içerik döner, kişisel veri içermez. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { notFound, parse } from '../lib/http';
import { getSettings } from '../services/settings';
import { PUBLIC_SETTINGS_KEYS } from '../../shared/settings';
import { RECIPE_CATEGORIES, type PublicRecipe, type PublicRecipeCard } from '../../shared/recipe';

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
  const [settings, services, faqs, categories, recipeCount] = await Promise.all([
    getSettings(PUBLIC_SETTINGS_KEYS),
    prisma.service.findMany({ where: { isPublished: true }, orderBy: { sortOrder: 'asc' }, select: publicService }),
    prisma.faq.findMany({ where: { isPublished: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, question: true, answer: true } }),
    prisma.blogCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, name: true } }),
    prisma.recipe.count({ where: PUBLISHED_RECIPE }),
  ]);
  // Panelde yapılan değişiklikler yenilemede hemen görünsün
  res.set('Cache-Control', 'no-cache');
  res.json({ settings, services: services.map(serializeService), faqs, categories, recipeCount });
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

// ───────────── Tarifler ─────────────
// Yalnızca yayınlanmış ve danışana bağlı OLMAYAN tarifler; iç alanlar (danışan, ana tarif, yazar) asla dönmez.

const PUBLISHED_RECIPE = { isPublished: true, clientId: null, slug: { not: null } } as const;

const recipeCard = {
  slug: true, title: true, category: true, summary: true, variantNote: true, servings: true, prepMinutes: true,
  cookMinutes: true, kcal: true, imageBase: true, publishedAt: true,
} as const;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const toCard = (r: { slug: string | null; publishedAt: Date | null } & Omit<PublicRecipeCard, 'slug' | 'publishedAt'>): PublicRecipeCard => ({
  ...r,
  slug: r.slug!,
  publishedAt: r.publishedAt?.toISOString() ?? null,
});

publicContentRouter.get('/recipes', async (req, res) => {
  const q = parse(z.object({ category: z.enum(RECIPE_CATEGORIES).optional(), limit: z.coerce.number().int().min(1).max(200).default(200) }), req.query);
  const rows = await prisma.recipe.findMany({
    where: { ...PUBLISHED_RECIPE, ...(q.category ? { category: q.category } : {}) },
    orderBy: { publishedAt: 'desc' },
    take: q.limit,
    select: recipeCard,
  });
  const counts = await prisma.recipe.groupBy({ by: ['category'], where: PUBLISHED_RECIPE, _count: true });
  res.json({ recipes: rows.map(toCard), counts: Object.fromEntries(counts.map((c) => [c.category, c._count])) });
});

publicContentRouter.get('/recipes/:slug', async (req, res) => {
  const r = await prisma.recipe.findFirst({
    where: { ...PUBLISHED_RECIPE, slug: req.params.slug },
    select: { ...recipeCard, ingredients: true, steps: true, tip: true, updatedAt: true },
  });
  if (!r) throw notFound('Tarif bulunamadı');
  const related = await prisma.recipe.findMany({
    where: { ...PUBLISHED_RECIPE, slug: { not: r.slug }, category: r.category },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: recipeCard,
  });
  const recipe: PublicRecipe = {
    ...toCard(r),
    ingredients: strings(r.ingredients),
    steps: strings(r.steps),
    tip: r.tip,
    updatedAt: r.updatedAt.toISOString(),
  };
  res.json({ recipe, related: related.map(toCard) });
});
