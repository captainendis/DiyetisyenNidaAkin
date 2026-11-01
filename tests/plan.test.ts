// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { genitive, planTitleFor, samplePlanTemplate, nutritionPlanDataSchema } from '../shared/plan';
import { renderPlanHtml } from '../shared/plan-template';

describe('genitive (Türkçe iyelik eki)', () => {
  it.each([
    ['Ömer', 'Ömer’in'], ['Ayşe', 'Ayşe’nin'], ['Nida', 'Nida’nın'], ['Burak', 'Burak’ın'],
    ['Gül', 'Gül’ün'], ['Mustafa', 'Mustafa’nın'], ['Ozan', 'Ozan’ın'], ['Duru', 'Duru’nun'], ['Elif', 'Elif’in'],
  ])('%s → %s', (name, expected) => expect(genitive(name)).toBe(expected));
  it('başlık üretir', () => expect(planTitleFor('Ömer')).toBe('Ömer’in beslenme planı'));
});

describe('plan şablonu', () => {
  it('örnek şablon şemaya uyar', () => {
    expect(nutritionPlanDataSchema.safeParse(samplePlanTemplate()).success).toBe(true);
  });
  it('kullanıcı metnini HTML olarak kaçırır', () => {
    const plan = samplePlanTemplate();
    plan.meals[0]!.options[0] = ['<script>alert(1)</script>', '"tırnak" & ve'];
    const html = renderPlanHtml(plan, { fontCss: '' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;tırnak&quot; &amp; ve');
  });
  it('boş alışkanlık ve porsiyon bölümlerini çizmez', () => {
    const plan = { ...samplePlanTemplate(), habits: { title: 'x', items: [] }, portions: { title: 'y', items: [] } };
    const html = renderPlanHtml(plan, { fontCss: '' });
    expect(html).not.toContain('class="habits"');
    expect(html).not.toContain('class="portions"');
  });
});
