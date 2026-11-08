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
import { prisma } from '../server/lib/db';
import { encryptJson } from '../server/lib/crypto';
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

    // Danışan silinince kişiye özel varyasyon ve fotoğrafı silinir
    await agent.delete(`/api/clients/${c.id}`).set('X-CSRF-Token', csrf).expect(200);
    clientId = '';
    expect(await prisma.recipe.findUnique({ where: { id: variant.id } })).toBeNull();
    expect(fs.existsSync(variantFile)).toBe(false);
  });
});
