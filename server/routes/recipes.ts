// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif kütüphanesi (/api/recipes). Tarifler beslenme planlarına ek sayfa olarak eklendiği için
 * planlarla aynı izinleri kullanır (clinical:read / clinical:write); kendileri sağlık verisi içermez.
 * Fotoğraflar meta verisi silinerek /uploads/public/recipes altına WebP olarak yazılır.
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, type Recipe as RecipeRow } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, HttpError, notFound, parse } from '../lib/http';
import { sniffMime } from '../lib/storage';
import { requirePermission } from '../auth/session';
import { deleteRecipeImage, processRecipeImage, recipeImageDataUri } from '../services/images';
import { RECIPE_CATEGORIES, recipeInputSchema, type PrintRecipe, type Recipe } from '../../shared/recipe';
import type { NutritionPlanData } from '../../shared/plan';

export const recipesRouter = Router();
const read = requirePermission('clinical:read');
const write = requirePermission('clinical:write');

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function toRecipe(r: RecipeRow): Recipe {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    summary: r.summary,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    kcal: r.kcal,
    ingredients: strings(r.ingredients),
    steps: strings(r.steps),
    tip: r.tip,
    imageBase: r.imageBase,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Plandaki tarif referanslarını PDF için çözer (sırayı korur; silinmiş tarifleri atlar, görseli gömer) */
export async function resolvePlanRecipes(plan: NutritionPlanData): Promise<PrintRecipe[]> {
  const items = plan.recipes?.items ?? [];
  if (!items.length) return [];
  const rows = await prisma.recipe.findMany({ where: { id: { in: items.map((i) => i.recipeId) } } });
  const byId = new Map(rows.map((r) => [r.id, toRecipe(r)]));
  const out: PrintRecipe[] = [];
  for (const it of items) {
    const r = byId.get(it.recipeId);
    if (!r) continue;
    const { id: _id, imageBase, createdAt: _c, updatedAt: _u, ...rest } = r;
    out.push({ ...rest, label: it.label, image: await recipeImageDataUri(imageBase) });
  }
  return out;
}

async function load(id: string) {
  const r = await prisma.recipe.findUnique({ where: { id } });
  if (!r) throw notFound('Tarif bulunamadı');
  return r;
}

recipesRouter.get('/', read, async (req, res) => {
  const q = parse(z.object({ q: z.string().trim().max(80).optional(), category: z.enum(RECIPE_CATEGORIES).optional() }), req.query);
  const rows = await prisma.recipe.findMany({
    where: {
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' as const } }, { summary: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
  });
  res.json({ items: rows.map(toRecipe) });
});

recipesRouter.get('/:id', read, async (req, res) => {
  res.json({ recipe: toRecipe(await load(String(req.params.id))) });
});

recipesRouter.post('/', write, async (req, res) => {
  const body = parse(recipeInputSchema, req.body);
  const r = await prisma.recipe.create({ data: { ...body, createdById: req.user!.id } });
  await audit(req, 'recipe.created', 'recipe', r.id);
  res.status(201).json({ recipe: toRecipe(r) });
});

recipesRouter.patch('/:id', write, async (req, res) => {
  const body = parse(recipeInputSchema, req.body);
  const existing = await load(String(req.params.id));
  const r = await prisma.recipe.update({ where: { id: existing.id }, data: body });
  await audit(req, 'recipe.updated', 'recipe', r.id);
  res.json({ recipe: toRecipe(r) });
});

recipesRouter.delete('/:id', write, async (req, res) => {
  const existing = await load(String(req.params.id));
  await prisma.recipe.delete({ where: { id: existing.id } });
  await deleteRecipeImage(existing.imageBase);
  await audit(req, 'recipe.deleted', 'recipe', existing.id);
  res.json({ ok: true });
});

// ───────────── Fotoğraf ─────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

recipesRouter.post('/:id/image', write, (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      return next(new HttpError(code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_ERROR', code === 'LIMIT_FILE_SIZE' ? 'Fotoğraf en fazla 15 MB olabilir.' : 'Fotoğraf yüklenemedi.'));
    }
    next();
  });
}, async (req, res) => {
  const existing = await load(String(req.params.id));
  const file = req.file;
  if (!file) throw badRequest('Fotoğraf seçilmedi');
  const mime = sniffMime(file.buffer);
  if (!mime || mime === 'application/pdf') throw badRequest('Yalnızca JPG, PNG, WebP veya AVIF fotoğraflar yüklenebilir.');
  let base: string;
  try {
    base = await processRecipeImage(file.buffer);
  } catch (e) {
    if ((e as Error).message === 'TOO_SMALL') throw badRequest('Fotoğraf çok küçük. En az 300×225 piksel olmalı; mümkünse 1200 piksel ve üzeri yükleyin.');
    throw badRequest('Fotoğraf işlenemedi. Farklı bir dosya deneyin.');
  }
  const r = await prisma.recipe.update({ where: { id: existing.id }, data: { imageBase: base } });
  await deleteRecipeImage(existing.imageBase);
  await audit(req, 'recipe.image_uploaded', 'recipe', r.id);
  res.status(201).json({ recipe: toRecipe(r) });
});

recipesRouter.delete('/:id/image', write, async (req, res) => {
  const existing = await load(String(req.params.id));
  const r = await prisma.recipe.update({ where: { id: existing.id }, data: { imageBase: null } });
  await deleteRecipeImage(existing.imageBase);
  await audit(req, 'recipe.image_removed', 'recipe', r.id);
  res.json({ recipe: toRecipe(r) });
});
