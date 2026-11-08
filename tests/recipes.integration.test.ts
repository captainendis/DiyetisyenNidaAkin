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

afterAll(async () => {
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
});
