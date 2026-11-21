// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif kütüphanesi (/api/recipes). Tarifler beslenme planlarına ek sayfa olarak eklendiği için
 * planlarla aynı izinleri kullanır (clinical:read / clinical:write).
 *  - Yayın: yalnızca "isPublished" işaretli ve danışana bağlı OLMAYAN tarifler sitede görünür (/api/public/recipes).
 *  - Varyasyon: parentId ana tarifi gösterir (her zaman kök tarife bağlanır); clientId doluysa kişiye özeldir,
 *    yayınlanamaz ve danışan silinince birlikte silinir.
 * Fotoğraflar meta verisi silinerek /uploads/public/recipes altına WebP olarak yazılır.
 */
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { audit } from '../lib/audit';
import { badRequest, body, HttpError, notFound, param, parse, query, readUpload, router } from '../lib/http';
import { sniffMime } from '../lib/storage';
import { authUser, requirePermission } from '../auth/session';
import { decryptNote, encryptNote } from '../services/recipe-notes';
import { decryptContent, encryptContent } from '../services/recipe-content';
import { copyRecipeImage, deleteRecipeImage, processRecipeImage, recipeImageDataUri } from '../services/images';
import { MAX_FEATURED_RECIPES, RECIPE_CATEGORIES, recipeCreateSchema, recipeInputSchema, type PrintRecipe, type Recipe, type RecipeInput } from '../../shared/recipe';
import type { NutritionPlanData } from '../../shared/plan';
import { slugify } from '../../shared/text';
import { ownedByDemoScope } from '../auth/reviewer';

export const recipesRouter = router();
const read = requirePermission('clinical:read');
const write = requirePermission('clinical:write');

const include = {
  parent: { select: { id: true, contentEnc: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.RecipeInclude;
type Row = Prisma.RecipeGetPayload<{ include: typeof include }>;

export function toRecipe(r: Row): Recipe {
  const c = decryptContent(r.contentEnc);
  return {
    id: r.id,
    title: c.title,
    category: r.category,
    summary: c.summary,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    kcal: r.kcal,
    ingredients: c.ingredients,
    steps: c.steps,
    tip: c.tip,
    dietTags: c.dietTags,
    isPublished: r.isPublished,
    isFeatured: !!r.featuredAt,
    variantNote: decryptNote(r.variantNoteEnc),
    clientId: r.clientId,
    imageBase: r.imageBase,
    slug: r.slug,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    featuredAt: r.featuredAt?.toISOString() ?? null,
    parentId: r.parentId,
    parent: r.parent ? { id: r.parent.id, title: decryptContent(r.parent.contentEnc).title } : null,
    client: r.client,
    variantCount: r._count.variants,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Plandaki tarif referanslarını PDF için çözer (sırayı korur; silinmiş tarifleri atlar, görseli gömer) */
export async function resolvePlanRecipes(plan: NutritionPlanData): Promise<PrintRecipe[]> {
  const items = plan.recipes?.items ?? [];
  if (!items.length) return [];
  const rows = await prisma.recipe.findMany({ where: { id: { in: items.map((i) => i.recipeId) } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: PrintRecipe[] = [];
  for (const it of items) {
    const r = byId.get(it.recipeId);
    if (!r) continue;
    const c = decryptContent(r.contentEnc);
    out.push({
      title: c.title,
      category: r.category,
      summary: c.summary,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      kcal: r.kcal,
      ingredients: c.ingredients,
      steps: c.steps,
      tip: c.tip,
      variantNote: decryptNote(r.variantNoteEnc),
      personal: !!r.clientId,
      label: it.label,
      image: await recipeImageDataUri(r.imageBase),
    });
  }
  return out;
}

/** Danışan silinmeden önce: kişiye özel tariflerin fotoğraf dosyalarını kaldırır (kayıtlar cascade ile silinir) */
export async function deleteClientRecipeImages(clientId: string) {
  const rows = await prisma.recipe.findMany({ where: { clientId }, select: { imageBase: true } });
  await Promise.all(rows.map((r) => deleteRecipeImage(r.imageBase)));
  return rows.length;
}

async function load(id: string) {
  const r = await prisma.recipe.findUnique({ where: { id }, include });
  if (!r) throw notFound('Tarif bulunamadı');
  return r;
}

const RESERVED_SLUGS = new Set(['home']);

async function uniqueSlug(title: string, ignoreId?: string) {
  const base = slugify(title).slice(0, 70) || 'tarif';
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (RESERVED_SLUGS.has(slug)) continue; // /api/public/recipes/home ile çakışmasın
    const hit = await prisma.recipe.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === ignoreId) return slug;
  }
}

const invalid = (field: string, message: string) => new HttpError(422, 'VALIDATION_ERROR', message, { fields: { [field]: message } });

/** Ana sayfa seçimi: yalnızca yayındaki, kişiye özel olmayan tarifler; en fazla MAX_FEATURED_RECIPES */
async function validateFeatured(body: Pick<RecipeInput, 'clientId' | 'isPublished' | 'isFeatured'>, selfId?: string) {
  if (!body.isFeatured) return;
  if (!body.isPublished || body.clientId) throw invalid('isFeatured', 'Ana sayfada yalnızca web sitesinde yayınlanan tarifler gösterilebilir.');
  const others = await prisma.recipe.count({ where: { featuredAt: { not: null }, ...(selfId ? { id: { not: selfId } } : {}) } });
  if (others >= MAX_FEATURED_RECIPES) {
    throw invalid('isFeatured', `Ana sayfada en fazla ${MAX_FEATURED_RECIPES} tarif gösterilebilir. Önce başka bir tarifi ana sayfadan çıkarın.`);
  }
}

/** Ortak kurallar: danışan var mı, kişiye özel tarif yayınlanamaz */
async function validateRelations(body: Pick<RecipeInput, 'clientId' | 'isPublished'>) {
  if (body.clientId) {
    const c = await prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true } });
    if (!c) throw notFound('Danışan bulunamadı');
    if (body.isPublished) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Kişiye özel tarifler web sitesinde yayınlanamaz', {
        fields: { isPublished: 'Kişiye özel tarifler web sitesinde yayınlanamaz. Önce danışan bağlantısını kaldırın.' },
      });
    }
  }
}

const fields = (b: RecipeInput) => ({
  // Ad, açıklama, malzemeler, adımlar, ipucu ve varyasyon notu yalnızca şifreli yazılır
  contentEnc: encryptContent(b),
  category: b.category, servings: b.servings, prepMinutes: b.prepMinutes, cookMinutes: b.cookMinutes, kcal: b.kcal,
  variantNoteEnc: encryptNote(b.variantNote), clientId: b.clientId, isPublished: b.isPublished,
});

recipesRouter.get('/', read, async (c) => {
  const q = parse(
    z.object({ q: z.string().trim().max(80).optional(), category: z.enum(RECIPE_CATEGORIES).optional(), clientId: z.string().max(40).optional() }),
    query(c),
  );
  const rows = await prisma.recipe.findMany({
    where: {
      AND: [ownedByDemoScope(c)],
      ...(q.category ? { category: q.category } : {}),
      ...(q.clientId ? { clientId: q.clientId } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
    include,
  });
  // İçerik şifreli olduğu için arama çözüldükten sonra bellekte yapılır (kütüphane küçük; en fazla 500 tarif)
  const needle = q.q?.toLocaleLowerCase('tr-TR');
  const items = rows.map(toRecipe).filter((r) => !needle || `${r.title} ${r.summary}`.toLocaleLowerCase('tr-TR').includes(needle));
  return c.json({ items });
});

recipesRouter.get('/:id', read, async (c) => {
  return c.json({ recipe: toRecipe(await load(param(c))) });
});

recipesRouter.post('/', write, async (c) => {
  const input = parse(recipeCreateSchema, await body(c));
  await validateRelations(input);
  await validateFeatured(input);
  let parentId: string | null = null;
  let imageBase: string | null = null;
  if (input.parentId) {
    const parent = await prisma.recipe.findUnique({ where: { id: input.parentId }, select: { id: true, parentId: true, imageBase: true } });
    if (!parent) throw notFound('Ana tarif bulunamadı');
    parentId = parent.parentId ?? parent.id; // varyasyonun varyasyonu da kök tarife bağlanır
    if (input.copyImage) imageBase = await copyRecipeImage(parent.imageBase);
  }
  const r = await prisma.recipe.create({
    data: {
      ...fields(input),
      parentId,
      imageBase,
      featuredAt: input.isFeatured ? new Date() : null,
      createdById: authUser(c).id,
      ...(input.isPublished ? { slug: await uniqueSlug(input.title), publishedAt: new Date() } : {}),
    },
    include,
  });
  await audit(c, parentId ? 'recipe.variant_created' : 'recipe.created', 'recipe', r.id, { parentId, personal: !!r.clientId });
  if (r.isPublished) await audit(c, 'recipe.published', 'recipe', r.id);
  return c.json({ recipe: toRecipe(r) }, 201);
});

recipesRouter.patch('/:id', write, async (c) => {
  const input = parse(recipeInputSchema, await body(c));
  const existing = await load(param(c));
  await validateRelations(input);
  await validateFeatured(input, existing.id);
  const publishing = input.isPublished && !existing.isPublished;
  const r = await prisma.recipe.update({
    where: { id: existing.id },
    data: {
      ...fields(input),
      // Seçilme zamanı korunur (ana sayfadaki sıra değişmesin); yayından kalkan tarif ana sayfadan da çıkar
      featuredAt: input.isFeatured && input.isPublished && !input.clientId ? (existing.featuredAt ?? new Date()) : null,
      // Adres ilk yayında atanır ve sonra değişmez (paylaşılan bağlantılar kırılmasın)
      ...(publishing ? { slug: existing.slug ?? (await uniqueSlug(input.title, existing.id)), publishedAt: existing.publishedAt ?? new Date() } : {}),
    },
    include,
  });
  await audit(c, 'recipe.updated', 'recipe', r.id);
  if (publishing) await audit(c, 'recipe.published', 'recipe', r.id);
  if (!input.isPublished && existing.isPublished) await audit(c, 'recipe.unpublished', 'recipe', r.id);
  if (!!r.featuredAt !== !!existing.featuredAt) await audit(c, r.featuredAt ? 'recipe.featured' : 'recipe.unfeatured', 'recipe', r.id);
  return c.json({ recipe: toRecipe(r) });
});

/** Hızlı seçim: ana sayfada göster / çıkar (kütüphanedeki "Ana sayfa" kutusundan) */
recipesRouter.put('/:id/featured', write, async (c) => {
  const { featured } = parse(z.object({ featured: z.boolean() }), await body(c));
  const existing = await load(param(c));
  if (featured && !existing.featuredAt) {
    await validateFeatured({ isFeatured: true, isPublished: existing.isPublished, clientId: existing.clientId }, existing.id);
  }
  const r = await prisma.recipe.update({
    where: { id: existing.id },
    data: { featuredAt: featured ? (existing.featuredAt ?? new Date()) : null },
    include,
  });
  if (!!r.featuredAt !== !!existing.featuredAt) await audit(c, featured ? 'recipe.featured' : 'recipe.unfeatured', 'recipe', r.id);
  return c.json({ recipe: toRecipe(r) });
});

recipesRouter.delete('/:id', write, async (c) => {
  const existing = await load(param(c));
  await prisma.recipe.delete({ where: { id: existing.id } }); // varyasyonlar kalır, ana tarif bağlantısı boşalır
  await deleteRecipeImage(existing.imageBase);
  await audit(c, 'recipe.deleted', 'recipe', existing.id, { variants: existing._count.variants });
  return c.json({ ok: true });
});

// ───────────── Fotoğraf ─────────────

recipesRouter.post('/:id/image', write, async (c) => {
  const file = await readUpload(c, { maxBytes: 15 * 1024 * 1024, tooLarge: new HttpError(413, 'UPLOAD_ERROR', 'Fotoğraf en fazla 15 MB olabilir.') });
  const existing = await load(param(c));
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
  const r = await prisma.recipe.update({ where: { id: existing.id }, data: { imageBase: base }, include });
  await deleteRecipeImage(existing.imageBase);
  await audit(c, 'recipe.image_uploaded', 'recipe', r.id);
  return c.json({ recipe: toRecipe(r) }, 201);
});

recipesRouter.delete('/:id/image', write, async (c) => {
  const existing = await load(param(c));
  const r = await prisma.recipe.update({ where: { id: existing.id }, data: { imageBase: null }, include });
  await deleteRecipeImage(existing.imageBase);
  await audit(c, 'recipe.image_removed', 'recipe', r.id);
  return c.json({ recipe: toRecipe(r) });
});
