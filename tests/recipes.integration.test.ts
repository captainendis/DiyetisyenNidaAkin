// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif kütüphanesi + plan ek sayfası entegrasyon testi — geliştirme veritabanına karşı çalışır,
 * oluşturduğu kayıtları ve görselleri siler. Gereksinimler appointments.integration.test.ts ile aynıdır.
 * PDF adımı Chromium yoksa (503) atlanır.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { resolveMeta } from '../server/seo';
import { prisma } from '../server/lib/db';
import { encryptJson } from '../server/lib/crypto';
import { encryptLegacyVariantNotes } from '../server/services/recipe-notes';
import { encryptContent, encryptLegacyRecipeContent } from '../server/services/recipe-content';
import { PUBLIC_UPLOADS } from '../server/lib/storage';
import { samplePlanTemplate } from '../shared/plan';
import type { Recipe } from '../shared/recipe';

const EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'nida@example.com';
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'GucluSifre2026';

const app = createApp();
const agent = request.agent(app);
let csrf = '';
const recipeIds: string[] = [];
let planId = '';

beforeAll(async () => {
  const login = await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  expect(login.status).toBe(200);
  csrf = (await agent.get('/api/auth/me')).body.user.csrfToken;
});

let clientId = '';

afterAll(async () => {
  if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
  const rows = await prisma.recipe.findMany({ where: { id: { in: recipeIds } } });
  for (const r of rows) {
    const id = r.imageBase?.split('/').pop();
    if (id) for (const w of [480, 960]) fs.rmSync(path.join(PUBLIC_UPLOADS, 'recipes', `${id}-${w}.webp`), { force: true });
  }
  await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
  if (planId) await prisma.nutritionPlan.deleteMany({ where: { id: planId } });
});

const body = {
  title: 'Test tarifi — yulaflı tost',
  category: 'BREAKFAST',
  servings: 1,
  prepMinutes: 5,
  ingredients: ['4 yemek kaşığı yulaf', '1 yumurta'],
  steps: ['Çırp.', 'Pişir.'],
};

describe('tarifler', () => {
  it('doğrulama hatalarını alan bazında döner', async () => {
    const res = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ title: '', category: 'X', ingredients: [], steps: [] });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['title', 'category', 'ingredients', 'steps']));
  });

  it('CSRF olmadan yazmaz', async () => {
    expect((await agent.post('/api/recipes').send(body)).status).toBe(403);
  });

  it('oluşturur, fotoğraf yükler (4:3, meta veri silinmiş), günceller', async () => {
    const created = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send(body);
    expect(created.status).toBe(201);
    const r = created.body.recipe as Recipe;
    recipeIds.push(r.id);
    expect(r).toMatchObject({ title: body.title, summary: '', imageBase: null, ingredients: body.ingredients });

    const jpg = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#c08040' } })
      .withMetadata({ exif: { IFD0: { Make: 'TestCam' } } })
      .jpeg()
      .toBuffer();
    const up = await agent.post(`/api/recipes/${r.id}/image`).set('X-CSRF-Token', csrf).attach('file', jpg, 'tost.jpg');
    expect(up.status).toBe(201);
    const base = up.body.recipe.imageBase as string;
    expect(base).toMatch(/^\/uploads\/public\/recipes\/[a-f0-9]{20}$/);
    const file = path.join(PUBLIC_UPLOADS, 'recipes', `${base.split('/').pop()}-960.webp`);
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([960, 720]);
    expect(meta.exif).toBeUndefined();

    const upd = await agent.patch(`/api/recipes/${r.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Test tarifi — güncel' });
    expect(upd.status).toBe(200);
    expect(upd.body.recipe.imageBase).toBe(base);

    const list = await agent.get('/api/recipes').query({ category: 'BREAKFAST', q: 'güncel' });
    expect(list.body.items.map((x: Recipe) => x.id)).toContain(r.id);
  });

  it('plana eklenen tarif PDF’e ek sayfa olarak basılır; silinen tarif atlanır', async () => {
    const gone = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, title: 'Test tarifi — silinecek' });
    recipeIds.push(gone.body.recipe.id);
    await agent.delete(`/api/recipes/${gone.body.recipe.id}`).set('X-CSRF-Token', csrf).expect(200);

    const data = samplePlanTemplate();
    data.recipes.items = [{ recipeId: recipeIds[0]!, label: 'Kahvaltı için öneri' }, { recipeId: gone.body.recipe.id, label: '' }];
    const plan = await prisma.nutritionPlan.create({ data: { isTemplate: true, name: 'Test planı (tarif)', dataEnc: encryptJson(data) } });
    planId = plan.id;

    const got = await agent.get(`/api/plans/${plan.id}`);
    expect(got.body.plan.data.recipes.items).toHaveLength(2);

    const pdf = await agent.get(`/api/plans/${plan.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    if (pdf.status === 503) return; // Chromium yok
    expect(pdf.status).toBe(200);
    expect(pdf.headers['x-plan-pages']).toBe('2');
    expect(pdf.headers['x-plan-recipes-fit']).toBe('true');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  }, 60_000);

  it('yalnızca işaretli ve kişiye özel olmayan tarifler sitede yayınlanır; adres sabit kalır', async () => {
    const pub = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, title: 'Test Yayın Çorbası', category: 'SOUP', isPublished: true });
    expect(pub.status).toBe(201);
    recipeIds.push(pub.body.recipe.id);
    const slug = pub.body.recipe.slug as string;
    expect(slug).toMatch(/^test-yayin-corbasi/);

    const draft = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, title: 'Test Taslak Çorbası', category: 'SOUP' });
    recipeIds.push(draft.body.recipe.id);
    expect(draft.body.recipe.slug).toBeNull();

    const list = await request(app).get('/api/public/recipes');
    const slugs = list.body.recipes.map((r: { slug: string }) => r.slug);
    expect(slugs).toContain(slug);
    expect(slugs).not.toContain(draft.body.recipe.slug);
    // İç alanlar dışarı sızmaz
    expect(Object.keys(list.body.recipes[0])).not.toEqual(expect.arrayContaining(['clientId', 'id', 'parentId']));

    // Başlık değişse de adres değişmez
    await agent.patch(`/api/recipes/${pub.body.recipe.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Yeni Ad', category: 'SOUP', isPublished: true }).expect(200);
    const detail = await request(app).get(`/api/public/recipes/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.recipe.title).toBe('Yeni Ad');
    // Sunucu taraflı SEO: şifreli içerik çözülerek başlık ve Schema.org Recipe verisine yazılır
    const meta = await resolveMeta(`/tarifler/${slug}`);
    expect(meta.title).toContain('Yeni Ad tarifi');
    const ld = meta.jsonLd?.find((x) => x['@type'] === 'Recipe');
    expect(ld).toMatchObject({ name: 'Yeni Ad', recipeIngredient: body.ingredients });

    // Yayından kaldırılınca 404
    await agent.patch(`/api/recipes/${pub.body.recipe.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Yeni Ad', category: 'SOUP', isPublished: false }).expect(200);
    expect((await request(app).get(`/api/public/recipes/${slug}`)).status).toBe(404);

    const sitemap = await request(app).get('/sitemap.xml');
    expect(sitemap.text).not.toContain(`/tarifler/${slug}`);
  });

  it('kişiye özel varyasyon: fotoğraf kopyalanır, yayınlanamaz, danışan silinince silinir', async () => {
    const c = await prisma.client.create({ data: { firstName: 'Test', lastName: 'Varyasyon', phone: '+905559990011' } });
    clientId = c.id;
    const baseId = recipeIds[0]!;
    const base = (await agent.get(`/api/recipes/${baseId}`)).body.recipe as Recipe;

    const bad = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, parentId: baseId, clientId: c.id, isPublished: true });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.fields.isPublished).toBeTruthy();

    const v = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, parentId: baseId, clientId: c.id, variantNote: 'Laktozsuz', copyImage: true });
    expect(v.status).toBe(201);
    const variant = v.body.recipe as Recipe;
    expect(variant).toMatchObject({ parentId: baseId, variantNote: 'Laktozsuz', isPublished: false, client: { id: c.id } });
    expect(variant.imageBase).toBeTruthy();
    expect(variant.imageBase).not.toBe(base.imageBase);
    const variantFile = path.join(PUBLIC_UPLOADS, 'recipes', `${variant.imageBase!.split('/').pop()}-960.webp`);
    expect(fs.existsSync(variantFile)).toBe(true);

    // Varyasyonun varyasyonu kök tarife bağlanır
    const vv = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, parentId: variant.id, variantNote: 'Vegan' });
    recipeIds.push(vv.body.recipe.id);
    expect(vv.body.recipe.parentId).toBe(baseId);
    expect((await agent.get(`/api/recipes/${baseId}`)).body.recipe.variantCount).toBe(2);

    // Danışana plan: tarif bağlantısıyla
    const planData = samplePlanTemplate();
    planData.title = 'Test’in beslenme planı';
    planData.recipes.items = [{ recipeId: variant.id, label: 'Kahvaltı için öneri' }];
    await prisma.nutritionPlan.create({ data: { clientId: c.id, name: 'Test planı (dışa aktarma)', dataEnc: encryptJson(planData) } });

    // KVKK dışa aktarma: kişiye özel tarif, çözülmüş varyasyon notu ve ana tarif adıyla yer alır
    const exp = await agent.get(`/api/clients/${c.id}/export`);
    expect(exp.status).toBe(200);
    const data = JSON.parse(exp.text);
    expect(data.personalRecipes).toHaveLength(1);
    expect(data.personalRecipes[0]).toMatchObject({ title: body.title, variantNote: 'Laktozsuz', basedOn: base.title, ingredients: body.ingredients });
    expect(data.personalRecipes[0].imageUrl).toMatch(/^\/uploads\/public\/recipes\/[a-f0-9]{20}-960\.webp$/);
    expect(JSON.stringify(data)).not.toContain('v1:'); // şifreli ham veri sızmaz
    // Beslenme planı çözülmüş içerikle ve okunur tarif adlarıyla yer alır
    expect(data.nutritionPlans).toHaveLength(1);
    expect(data.nutritionPlans[0]).toMatchObject({ name: 'Test planı (dışa aktarma)', content: { title: 'Test’in beslenme planı' } });
    expect(data.nutritionPlans[0].content.meals.length).toBeGreaterThan(0);
    expect(data.nutritionPlans[0].attachedRecipes).toEqual([{ title: body.title, label: 'Kahvaltı için öneri' }]);
    expect(data).not.toHaveProperty('nutritionPlans.0.dataEnc');

    // Danışan silinince kişiye özel varyasyon ve fotoğrafı silinir
    await agent.delete(`/api/clients/${c.id}`).set('X-CSRF-Token', csrf).expect(200);
    clientId = '';
    expect(await prisma.recipe.findUnique({ where: { id: variant.id } })).toBeNull();
    expect(fs.existsSync(variantFile)).toBe(false);
  });

  it('ana sayfa: seçim yoksa son yayınlananlar, seçilince yalnızca seçilenler (en fazla 3, seçim sırasıyla)', async () => {
    // Diğer testlerden / geliştirme verisinden gelen seçimleri geçici olarak kaldır
    const before = await prisma.recipe.findMany({ where: { featuredAt: { not: null } }, select: { id: true, featuredAt: true } });
    await prisma.recipe.updateMany({ where: { featuredAt: { not: null } }, data: { featuredAt: null } });
    try {
      const mk = async (title: string) => {
        const r = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, title, isPublished: true });
        recipeIds.push(r.body.recipe.id);
        return r.body.recipe as Recipe;
      };
      const [a, b, c, d] = [await mk('Test AS A'), await mk('Test AS B'), await mk('Test AS C'), await mk('Test AS D')];

      let home = await request(app).get('/api/public/recipes/home');
      expect(home.body.selected).toBe(false);
      expect(home.body.recipes.map((r: { title: string }) => r.title)).toEqual(['Test AS D', 'Test AS C', 'Test AS B']);

      for (const r of [b, d, a]) await agent.put(`/api/recipes/${r.id}/featured`).set('X-CSRF-Token', csrf).send({ featured: true }).expect(200);
      const over = await agent.put(`/api/recipes/${c.id}/featured`).set('X-CSRF-Token', csrf).send({ featured: true });
      expect(over.status).toBe(422);
      expect(over.body.error.details.fields.isFeatured).toMatch(/en fazla 3/);

      home = await request(app).get('/api/public/recipes/home');
      expect(home.body.selected).toBe(true);
      expect(home.body.recipes.map((r: { title: string }) => r.title)).toEqual(['Test AS B', 'Test AS D', 'Test AS A']);

      // Düzenlemede seçim sırası korunur; yayından kaldırılan tarif ana sayfadan da çıkar
      await agent.patch(`/api/recipes/${b.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Test AS B2', isPublished: true, isFeatured: true }).expect(200);
      await agent.patch(`/api/recipes/${d.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Test AS D', isPublished: false, isFeatured: true }).expect(422);
      const off = await agent.patch(`/api/recipes/${d.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Test AS D', isPublished: false });
      expect(off.body.recipe.isFeatured).toBe(false);
      home = await request(app).get('/api/public/recipes/home');
      expect(home.body.recipes.map((r: { title: string }) => r.title)).toEqual(['Test AS B2', 'Test AS A']);

      // "home" adresi ayrılmış: bu adla yayınlanan tarif farklı adres alır
      const h = await mk('Home');
      expect(h.slug).not.toBe('home');
    } finally {
      await prisma.recipe.updateMany({ where: { id: { in: recipeIds } }, data: { featuredAt: null } });
      for (const r of before) await prisma.recipe.updateMany({ where: { id: r.id }, data: { featuredAt: r.featuredAt } });
    }
  });

  it('varyasyon notu veritabanında yalnızca şifreli durur; API ve PDF çözülmüş hâlini kullanır', async () => {
    const note = 'Çölyak: glutensiz ekmekle';
    const res = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send({ ...body, title: 'Test şifreli not', variantNote: note });
    expect(res.status).toBe(201);
    recipeIds.push(res.body.recipe.id);
    expect(res.body.recipe.variantNote).toBe(note);

    const row = await prisma.recipe.findUniqueOrThrow({ where: { id: res.body.recipe.id } });
    expect(row.variantNoteEnc).toMatch(/^v1:/);
    expect(row.variantNoteEnc).not.toContain('glutensiz');

    // Not silinince şifreli alan da boşalır
    const cleared = await agent.patch(`/api/recipes/${row.id}`).set('X-CSRF-Token', csrf).send({ ...body, title: 'Test şifreli not', variantNote: '' });
    expect(cleared.body.recipe.variantNote).toBe('');
    expect((await prisma.recipe.findUniqueOrThrow({ where: { id: row.id } })).variantNoteEnc).toBeNull();
  });

  it('sürüm atlanmış kurulumda eski düz metin sütunu: notlar şifrelenir, sütun kaldırılır (idempotent)', async () => {
    const hasColumn = async () =>
      Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'recipes' AND column_name = 'variantNote'`)[0]!.n) > 0;
    // Normal kurulumda migration sütunu silmiş olmalı
    expect(await hasColumn()).toBe(false);

    // Notları henüz taşınmamış eski bir kurulumu taklit et
    await prisma.$executeRawUnsafe(`ALTER TABLE "recipes" ADD COLUMN "variantNote" TEXT NOT NULL DEFAULT ''`);
    try {
      const legacy = await prisma.recipe.create({
        data: { category: 'SOUP', contentEnc: encryptContent({ title: 'Test eski not', summary: '', ingredients: ['a'], steps: ['b'], tip: '' }) },
      });
      recipeIds.push(legacy.id);
      await prisma.$executeRaw`UPDATE "recipes" SET "variantNote" = 'Laktozsuz' WHERE id = ${legacy.id}`;

      expect(await encryptLegacyVariantNotes()).toBe(1);
      expect(await hasColumn()).toBe(false);
      const row = await prisma.recipe.findUniqueOrThrow({ where: { id: legacy.id } });
      expect(row.variantNoteEnc).toMatch(/^v1:/);
      expect((await agent.get(`/api/recipes/${legacy.id}`)).body.recipe.variantNote).toBe('Laktozsuz');
      expect(await encryptLegacyVariantNotes()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "recipes" DROP COLUMN IF EXISTS "variantNote"');
    }
  });

  it('tarif içeriği (ad, açıklama, malzemeler, adımlar, ipucu) veritabanında yalnızca şifreli durur; arama çalışır', async () => {
    const secret = { ...body, title: 'Test Glutensiz Kek', summary: 'Çölyak için', tip: 'Laktozsuz sütle', ingredients: ['glutensiz un'], steps: ['karıştır'] };
    const res = await agent.post('/api/recipes').set('X-CSRF-Token', csrf).send(secret);
    expect(res.status).toBe(201);
    recipeIds.push(res.body.recipe.id);
    expect(res.body.recipe).toMatchObject({ title: secret.title, summary: secret.summary, tip: secret.tip, ingredients: secret.ingredients, steps: secret.steps });

    // Ham satırın hiçbir sütununda düz metin yok
    const raw = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM "recipes" WHERE id = ${res.body.recipe.id}`;
    const dump = JSON.stringify(raw[0]);
    for (const word of ['Glutensiz', 'Çölyak', 'Laktozsuz', 'glutensiz un', 'karıştır']) expect(dump).not.toContain(word);
    expect(raw[0]!.contentEnc).toMatch(/^v1:/);

    // Panel araması çözülmüş içerik üzerinde çalışır
    const hit = await agent.get('/api/recipes').query({ q: 'glutensiz kek' });
    expect(hit.body.items.map((r: Recipe) => r.id)).toContain(res.body.recipe.id);
  });

  it('sürüm atlanmış kurulumda düz metin içerik sütunları: içerik şifrelenir, sütunlar kaldırılır (idempotent)', async () => {
    const legacyColumns = async () =>
      (await prisma.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'recipes'
          AND column_name IN ('title', 'summary', 'ingredients', 'steps', 'tip')`).map((c) => c.column_name);
    expect(await legacyColumns()).toEqual([]);

    // İçeriği henüz taşınmamış eski bir kurulumu taklit et
    await prisma.$executeRawUnsafe(`ALTER TABLE "recipes" ADD COLUMN "title" TEXT, ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
      ADD COLUMN "ingredients" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "tip" TEXT NOT NULL DEFAULT ''`);
    try {
      const legacy = await prisma.recipe.create({ data: { category: 'SOUP' } });
      recipeIds.push(legacy.id);
      await prisma.$executeRaw`UPDATE "recipes" SET "contentEnc" = NULL, "title" = 'Eski çorba', "summary" = 'Eski özet',
        "ingredients" = '["mercimek"]'::jsonb, "steps" = '["pişir"]'::jsonb, "tip" = 'Limonla' WHERE id = ${legacy.id}`;

      expect(await encryptLegacyRecipeContent()).toBe(1);
      expect(await legacyColumns()).toEqual([]);
      const r = (await agent.get(`/api/recipes/${legacy.id}`)).body.recipe as Recipe;
      expect(r).toMatchObject({ title: 'Eski çorba', summary: 'Eski özet', ingredients: ['mercimek'], steps: ['pişir'], tip: 'Limonla' });
      expect(await encryptLegacyRecipeContent()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "title", DROP COLUMN IF EXISTS "summary",
        DROP COLUMN IF EXISTS "ingredients", DROP COLUMN IF EXISTS "steps", DROP COLUMN IF EXISTS "tip"`);
    }
  });
});

