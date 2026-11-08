// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { recipeInputSchema, recipeMeta, type PrintRecipe } from '../shared/recipe';
import { MAX_PLAN_RECIPES, nutritionPlanDataSchema, samplePlanTemplate } from '../shared/plan';
import { renderPlanHtml } from '../shared/plan-template';

const recipe = (over: Partial<PrintRecipe> = {}): PrintRecipe => ({
  title: 'Yulaflı tost',
  category: 'BREAKFAST',
  summary: '',
  servings: 1,
  prepMinutes: 5,
  cookMinutes: null,
  kcal: 340,
  ingredients: ['4 yemek kaşığı yulaf', '1 yumurta'],
  steps: ['Çırp.', 'Pişir.'],
  tip: '',
  image: null,
  label: 'Kahvaltı için öneri',
  variantNote: '',
  personal: false,
  ...over,
});

describe('tarif şeması', () => {
  it('en az bir malzeme ve adım ister', () => {
    const r = recipeInputSchema.safeParse({ title: 'X', category: 'SOUP', ingredients: [], steps: [] });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain('ingredients');
    expect(paths).toContain('steps');
  });
  it('isteğe bağlı alanlara varsayılan verir', () => {
    const r = recipeInputSchema.parse({ title: 'Çorba', category: 'SOUP', ingredients: ['mercimek'], steps: ['pişir'] });
    expect(r).toMatchObject({ summary: '', tip: '', servings: null, kcal: null, prepMinutes: null, cookMinutes: null });
  });
  it('bilinmeyen kategoriyi reddeder', () => {
    expect(recipeInputSchema.safeParse({ title: 'X', category: 'PIZZA', ingredients: ['a'], steps: ['b'] }).success).toBe(false);
  });
  it('künye satırı üretir', () => {
    expect(recipeMeta({ servings: 2, prepMinutes: 10, cookMinutes: 0, kcal: 190 })).toEqual(['2 porsiyon', '10 dk hazırlık', 'porsiyonu ~190 kcal']);
  });
});

describe('plan + tarif ek sayfası', () => {
  it('tarif alanı olmayan eski planlar varsayılanla okunur', () => {
    const { recipes: _r, ...old } = samplePlanTemplate();
    const parsed = nutritionPlanDataSchema.parse(old);
    expect(parsed.recipes).toEqual({ title: 'Tarif önerileri', items: [] });
  });
  it(`en fazla ${MAX_PLAN_RECIPES} tarif eklenebilir`, () => {
    const plan = samplePlanTemplate();
    plan.recipes.items = Array.from({ length: MAX_PLAN_RECIPES + 1 }, (_, i) => ({ recipeId: `r${i}`, label: '' }));
    expect(nutritionPlanDataSchema.safeParse(plan).success).toBe(false);
  });
  it('tarif yoksa ek sayfa iskeleti çizilmez', () => {
    const html = renderPlanHtml(samplePlanTemplate(), { fontCss: '' });
    expect(html).not.toContain('recipe-pool');
    expect(html).not.toContain('sonraki sayfada');
  });
  it('tarifleri havuza yazar, 1. sayfada ek sayfayı haber verir ve metni kaçırır', () => {
    const html = renderPlanHtml(samplePlanTemplate(), {
      fontCss: '',
      recipes: [recipe({ title: '<b>Tost</b>', steps: ['"Çırp" & pişir'], image: 'data:image/webp;base64,AAAA' }), recipe({ title: 'Smoothie', category: 'SNACK', label: '' })],
    });
    expect(html).toContain('id="recipe-pool"');
    expect(html).toContain('id="recipe-sheet-tpl"');
    expect(html).toContain('Tarif önerileri sonraki sayfada.');
    expect(html).toContain('&lt;b&gt;Tost&lt;/b&gt;');
    expect(html).toContain('&quot;Çırp&quot; &amp; pişir');
    expect(html).toContain('src="data:image/webp;base64,AAAA"');
    // Etiket boşsa kategori adı gösterilir
    expect(html).toContain('<p class="r-label">Ara öğün</p>');
    expect(html.match(/<article class="recipe/g)).toHaveLength(2);
  });
  it('kişiye özel varyasyonu "Sana özel" notuyla basar', () => {
    const html = renderPlanHtml(samplePlanTemplate(), { fontCss: '', recipes: [recipe({ personal: true, variantNote: 'Laktozsuz <süt>' })] });
    expect(html).toContain('<p class="r-var"><b>Sana özel.</b> Laktozsuz &lt;süt&gt;</p>');
    const plain = renderPlanHtml(samplePlanTemplate(), { fontCss: '', recipes: [recipe()] });
    expect(plain).not.toContain('class="r-var"');
  });
});
