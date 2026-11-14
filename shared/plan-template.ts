// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planı — tek sayfa A4 HTML şablonu.
 * Aynı şablon paneldeki canlı önizlemede (iframe srcdoc) ve sunucunun yazdırma sayfasında (server/services/print.ts) kullanılır.
 *
 * Telefonda okunabilirlik: PDF vektör metin içerir (yakınlaştırınca bulanıklaşmaz), yazı boyutları
 * A4 baskıda da rahat okunacak şekilde seçilmiştir. İçerik uzarsa fitPlanToPage() tüm ölçüleri
 * orantılı küçültür; MIN_SCALE altına inmesi gerekirse "sığmıyor" sonucu döner.
 */
import { PLAN_THEMES, type NutritionPlanData, type PlanThemeColors } from './plan';
import { RECIPE_CATEGORY_LABEL, recipeMeta, type PrintRecipe } from './recipe';

export const MIN_SCALE = 0.72;
/** Tarif sayfalarında tek bir tarif sayfaya sığmazsa inilebilecek en küçük ölçek */
export const RECIPE_MIN_SCALE = 0.7;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Kart zemini sayfa zeminiyle aynıysa (yazıcı dostu tema) kartlar ince bir çerçeveyle ayrılır */
const outline = (t: PlanThemeColors) => (t.card.toLowerCase() === t.bg.toLowerCase() ? `box-shadow: inset 0 0 0 0.8pt ${t.line};` : '');

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const CUP = `<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 1h10l-1.3 13.2a1 1 0 0 1-1 .8H3.3a1 1 0 0 1-1-.8L1 1Z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

function renderRecipe(r: PrintRecipe) {
  const meta = recipeMeta(r);
  return `
    <article class="recipe${r.image ? ' has-img' : ''}">
      <div class="r-top">
        ${r.image ? `<div class="r-img"><img src="${esc(r.image)}" alt=""></div>` : ''}
        <div class="r-head">
          <p class="r-label">${esc(r.label || RECIPE_CATEGORY_LABEL[r.category] || '')}</p>
          <h2 class="r-title">${esc(r.title)}</h2>
          ${r.variantNote || r.personal ? `<p class="r-var">${r.personal ? '<b>Sana özel.</b> ' : ''}${esc(r.variantNote)}</p>` : ''}
          ${meta.length ? `<p class="r-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
          ${r.summary ? `<p class="r-sum">${esc(r.summary)}</p>` : ''}
        </div>
      </div>
      <div class="r-body">
        <section><h3>Malzemeler</h3><ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>
        <section><h3>Hazırlanışı</h3><ol>${r.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol></section>
      </div>
      ${r.tip ? `<p class="r-tip"><b>İpucu.</b> ${esc(r.tip)}</p>` : ''}
    </article>`;
}

export interface RenderPlanOptions {
  fontCss: string;
  title?: string;
  /** Ek sayfa(lar)da basılacak tarifler, plandaki sırayla */
  recipes?: PrintRecipe[];
}

export function renderPlanHtml(plan: NutritionPlanData, opts: RenderPlanOptions) {
  const t = (PLAN_THEMES[plan.theme] ?? PLAN_THEMES.green).colors;
  const recipes = opts.recipes ?? [];
  const recipesTitle = plan.recipes?.title?.trim() || 'Tarif önerileri';
  const cols = Math.max(1, ...plan.meals.map((m) => m.options.length));
  const glasses = plan.water.glasses;
  const perRow = glasses > 12 ? Math.ceil(glasses / 2) : glasses;

  const header = `
    <header class="head">
      <h1>${esc(plan.title.replace(/'/g, '’'))}</h1>
      <div class="trackers">
        ${plan.water.show && (plan.water.liters || glasses) ? `
        <div class="tracker">
          <div class="t-label"><strong>Su${plan.water.liters ? `, ${esc(plan.water.liters)} litre` : ''}</strong>${glasses ? `<span>${glasses} bardak${plan.water.glassMl ? ` × ${plan.water.glassMl} ml` : ''}</span>` : ''}</div>
          ${glasses ? `<div class="cups" style="grid-template-columns:repeat(${perRow},auto)">${CUP.repeat(glasses)}</div>` : ''}
        </div>` : ''}
        ${plan.activity.show && plan.activity.label ? `
        <div class="tracker">
          <div class="t-label"><strong>${esc(plan.activity.label)}</strong></div>
          <div class="days">${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}</div>
        </div>` : ''}
      </div>
      ${plan.subtitle || recipes.length ? `<p class="sub">${esc(plan.subtitle)}${recipes.length ? `${plan.subtitle ? ' ' : ''}<span class="rnote">${esc(recipesTitle)} sonraki sayfada.</span>` : ''}</p>` : ''}
    </header>`;

  const footer = `<footer class="foot"><span>${esc(plan.footerNote)}</span>${plan.signature ? `<span class="sig">${esc(plan.signature)}</span>` : ''}</footer>`;
  // Tarif sayfalarında alt not tekrarlanmaz; yalnızca imza
  const recipeFooter = `<footer class="foot"><span></span>${plan.signature ? `<span class="sig">${esc(plan.signature)}</span>` : ''}</footer>`;

  // Tarif sayfaları: bloklar önce gizli havuza yazılır, fitPlanToPage() bunları ölçerek A4 sayfalara dağıtır
  const recipePages = recipes.length
    ? `<template id="recipe-sheet-tpl"><main class="sheet rsheet"><div class="content"><header class="rhead"><h1>${esc(recipesTitle)}</h1><p class="sub">${esc(plan.title.replace(/'/g, '’'))}</p></header><div class="rlist"></div></div>${recipeFooter}</main></template>
<div id="recipe-pool" hidden>${recipes.map(renderRecipe).join('')}</div>`
    : '';

  const meals = plan.meals
    .map((m) => {
      const options = Array.from({ length: cols }, (_, i) => m.options[i] ?? null);
      return `
      <section class="meal">
        <div class="when"><span class="dot"></span><div><p class="time">${esc(m.time)}</p><p class="mname">${esc(m.name)}</p></div></div>
        <div class="card" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
          ${options
            .map((o, i) =>
              o === null
                ? '<div class="opt"></div>'
                : `<div class="opt">${cols > 1 ? `<p class="opt-h">${i + 1}. seçenek</p>` : ''}<ul>${o.filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`,
            )
            .join('')}
        </div>
      </section>`;
    })
    .join('');

  const hasHabits = plan.habits.items.length > 0;
  const hasPortions = plan.portions.items.length > 0;
  const bottom =
    hasHabits || hasPortions
      ? `<div class="bottom ${hasHabits && hasPortions ? 'two' : ''}">
        ${hasHabits ? `<section class="habits"><h2>${esc(plan.habits.title)}</h2>${plan.habits.items.map((h) => `<p><b>${esc(h.title)}</b> ${esc(h.text)}</p>`).join('')}</section>` : ''}
        ${hasPortions ? `<section class="portions"><h2>${esc(plan.portions.title)}</h2><div class="chips">${plan.portions.items.map((p) => `<div class="chip"><b>${esc(p.name)}</b><span>${esc(p.amount)}</span></div>`).join('')}</div></section>` : ''}
      </div>`
      : '';

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${esc(opts.title ?? plan.title)}</title>
<style>
${opts.fontCss}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${t.bg}; }
@media screen { html, body { background: #D9D3CA; } .sheet { background: ${t.bg}; } .sheet + .sheet { margin-top: 24px; } }
.sheet + .sheet { break-before: page; }
body { font-family: 'Manrope Variable', Manrope, 'Segoe UI', Arial, sans-serif; color: ${t.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { --s: 1; width: 210mm; height: 297mm; overflow: hidden; padding: calc(11mm * var(--s)) 11mm calc(8mm * var(--s)); display: flex; flex-direction: column; }
.content { flex: none; display: flex; flex-direction: column; gap: calc(3.2mm * var(--s)); }
.head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 6mm; align-items: start; }
h1 { font-size: calc(30pt * var(--s)); line-height: 1.02; font-weight: 800; letter-spacing: -0.02em; max-width: 105mm; }
.sub { grid-column: 1 / -1; margin-top: calc(2.4mm * var(--s)); font-size: calc(10.5pt * var(--s)); color: ${t.muted}; font-weight: 500; }
.trackers { display: flex; flex-direction: column; gap: calc(2.6mm * var(--s)); padding-top: 1mm; }
.tracker { display: flex; align-items: center; justify-content: flex-end; gap: 3mm; }
.t-label { text-align: right; font-size: calc(8.6pt * var(--s)); line-height: 1.25; color: ${t.muted}; max-width: 28mm; }
.t-label strong { display: block; color: ${t.muted}; font-weight: 700; }
.t-label span { display: block; font-weight: 700; }
.cups { display: grid; gap: 1.1mm 1.4mm; color: ${t.ink}; }
.cups svg { width: calc(3.6mm * var(--s)); height: calc(4.8mm * var(--s)); display: block; }
.days { display: flex; gap: 1.3mm; }
.days span { width: calc(7.6mm * var(--s)); height: calc(7.6mm * var(--s)); border: 1.1pt solid ${t.ink}; border-radius: 50%; display: grid; place-items: center; font-size: calc(7.6pt * var(--s)); font-weight: 700; }
.timeline { position: relative; display: flex; flex-direction: column; gap: calc(2.4mm * var(--s)); }
.timeline::before { content: ''; position: absolute; left: 2.1mm; top: 5mm; bottom: 6mm; width: 1.1pt; background: ${t.line}; }
.meal { display: grid; grid-template-columns: 24mm minmax(0, 1fr); gap: 2mm; align-items: start; }
.when { display: flex; gap: 2.2mm; padding-top: calc(3.2mm * var(--s)); position: relative; }
.dot { flex: none; width: 4.4mm; height: 4.4mm; border-radius: 50%; background: ${t.accent}; border: 1.3pt solid ${t.ink}; margin-top: calc(1.2mm * var(--s)); position: relative; z-index: 1; }
.time { font-size: calc(17pt * var(--s)); font-weight: 800; line-height: 1.05; letter-spacing: -0.01em; }
.mname { font-size: calc(8.8pt * var(--s)); color: ${t.muted}; font-weight: 600; line-height: 1.2; margin-top: 0.6mm; }
.card { background: ${t.card}; ${outline(t)} border-radius: 3.5mm; padding: calc(3.2mm * var(--s)) calc(4mm * var(--s)); display: grid; gap: 0 calc(4mm * var(--s)); }
.opt + .opt { border-left: 0.8pt solid ${t.line}; padding-left: calc(4mm * var(--s)); }
.opt-h { font-size: calc(8.4pt * var(--s)); color: ${t.muted}; font-weight: 700; margin-bottom: calc(0.8mm * var(--s)); }
.opt ul { list-style: none; }
.opt li { font-size: calc(10.4pt * var(--s)); line-height: 1.42; font-weight: 500; }
.bottom { display: grid; grid-template-columns: 1fr; gap: 4mm; margin-top: calc(1.4mm * var(--s)); }
.bottom.two { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
.bottom h2 { font-size: calc(13pt * var(--s)); font-weight: 800; margin-bottom: calc(2.4mm * var(--s)); letter-spacing: -0.01em; }
.habits { background: ${t.dark}; color: ${t.darkInk}; border-radius: 3.5mm; padding: calc(5mm * var(--s)) calc(5.5mm * var(--s)); }
.habits p { font-size: calc(9.6pt * var(--s)); line-height: 1.5; margin-top: calc(2mm * var(--s)); opacity: 0.95; }
.habits b { color: ${t.darkAccent}; font-weight: 800; }
.portions { background: ${t.card}; ${outline(t)} border-radius: 3.5mm; padding: calc(5mm * var(--s)) calc(5mm * var(--s)); }
.chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2mm; }
.chip { background: ${t.chip}; border-radius: 2mm; padding: calc(1.8mm * var(--s)) calc(2.4mm * var(--s)); }
.chip b { display: block; font-size: calc(9.6pt * var(--s)); font-weight: 800; }
.chip span { display: block; font-size: calc(8.6pt * var(--s)); color: ${t.muted}; font-weight: 500; }
.foot { margin-top: auto; padding-top: calc(3mm * var(--s)); display: flex; justify-content: space-between; gap: 6mm; font-size: calc(8.8pt * var(--s)); color: ${t.muted}; font-weight: 500; }
.foot .sig { white-space: nowrap; }
.rnote { color: ${t.ink}; font-weight: 700; }
.rhead { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm; }
.rhead h1 { font-size: calc(24pt * var(--s)); max-width: none; }
.rhead .sub { margin-top: 0; text-align: right; }
.rlist { display: flex; flex-direction: column; gap: calc(4mm * var(--s)); }
.recipe { background: ${t.card}; ${outline(t)} border-radius: 3.5mm; padding: calc(5mm * var(--s)) calc(5.5mm * var(--s)); break-inside: avoid; }
.r-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: calc(5mm * var(--s)); align-items: start; }
.recipe.has-img .r-top { grid-template-columns: calc(58mm * var(--s)) minmax(0, 1fr); }
.r-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 2.5mm; overflow: hidden; background: ${t.chip}; }
.r-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.r-label { display: inline-block; background: ${t.accent}; color: ${t.ink}; border-radius: 99px; padding: calc(0.7mm * var(--s)) calc(2.6mm * var(--s)); font-size: calc(8pt * var(--s)); font-weight: 800; letter-spacing: 0.02em; }
.r-title { font-size: calc(17pt * var(--s)); font-weight: 800; line-height: 1.12; letter-spacing: -0.01em; margin-top: calc(2mm * var(--s)); }
.r-var { font-size: calc(9.4pt * var(--s)); font-weight: 600; color: ${t.ink}; margin-top: calc(1.2mm * var(--s)); }
.r-var b { font-weight: 800; color: ${t.ink}; background: ${t.chip}; border-radius: 1.2mm; padding: 0 1.4mm; }
.r-meta { display: flex; flex-wrap: wrap; gap: calc(1.2mm * var(--s)) calc(1.6mm * var(--s)); margin-top: calc(2.2mm * var(--s)); }
.r-meta span { background: ${t.chip}; border-radius: 1.5mm; padding: calc(0.6mm * var(--s)) calc(2mm * var(--s)); font-size: calc(8.4pt * var(--s)); font-weight: 600; color: ${t.muted}; }
.r-sum { font-size: calc(9.8pt * var(--s)); line-height: 1.45; color: ${t.muted}; font-weight: 500; margin-top: calc(2.4mm * var(--s)); }
.r-body { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: calc(6mm * var(--s)); margin-top: calc(4mm * var(--s)); }
.r-body section + section { border-left: 0.8pt solid ${t.line}; padding-left: calc(6mm * var(--s)); }
.r-body h3 { font-size: calc(8.6pt * var(--s)); color: ${t.muted}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: calc(1.6mm * var(--s)); }
.r-body ul { list-style: none; }
.r-body ul li { font-size: calc(10pt * var(--s)); line-height: 1.45; font-weight: 500; padding-left: 3.2mm; position: relative; }
.r-body ul li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 1.4mm; height: 1.4mm; border-radius: 50%; background: ${t.accent}; }
.r-body ol { list-style: none; counter-reset: st; }
.r-body ol li { counter-increment: st; font-size: calc(10pt * var(--s)); line-height: 1.45; font-weight: 500; padding-left: 6mm; position: relative; }
.r-body ol li + li { margin-top: calc(1.2mm * var(--s)); }
.r-body ol li::before { content: counter(st); position: absolute; left: 0; top: 0.1em; width: 4.2mm; height: 4.2mm; border-radius: 50%; border: 1pt solid ${t.ink}; font-size: 7pt; font-weight: 800; display: grid; place-items: center; line-height: 1; }
.r-tip { margin-top: calc(3.4mm * var(--s)); background: ${t.chip}; border-radius: 2mm; padding: calc(2mm * var(--s)) calc(3mm * var(--s)); font-size: calc(9.4pt * var(--s)); line-height: 1.45; font-weight: 500; }
.r-tip b { font-weight: 800; }
</style></head>
<body><main class="sheet" id="sheet"><div class="content" id="content">
${header}
<div class="timeline">${meals}</div>
${bottom}
</div>
${footer}
</main>
${recipePages}
</body></html>`;
}

export interface FitResult {
  /** Plan sayfasının (1. sayfa) ölçeği */
  scale: number;
  /** Plan sayfası MIN_SCALE ile sığdı mı */
  fits: boolean;
  /** Toplam sayfa sayısı (plan + tarif sayfaları) */
  pages: number;
  /** Tüm tarifler sayfalara sığdı mı (bir tarif tek başına bir sayfayı aşarsa false) */
  recipesFit: boolean;
}

/**
 * Sayfaya sığdırma ve tarif sayfalarını oluşturma.
 *  1) Plan sayfası taşıyorsa ölçeği adım adım küçültür.
 *  2) Tarif blokları havuzdan sırayla A4 sayfalara yerleştirilir; sığmayan blok yeni sayfaya geçer,
 *     tek başına da sığmıyorsa o sayfa RECIPE_MIN_SCALE'e kadar küçültülür.
 * Hem önizlemede hem yazdırma sayfasında tarayıcıda çalışır; dış değişken kullanmaz
 * (page.evaluate ile serileştirilebilmesi için) — minimum ölçekler parametre olarak gelir.
 */
export function fitPlanToPage(doc: Document, minScale: number, recipeMinScale = 0.7): FitResult {
  const sheet = doc.getElementById('sheet') as HTMLElement | null;
  if (!sheet) return { scale: 1, fits: true, pages: 1, recipesFit: true };
  const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1;
  const shrink = (el: HTMLElement, min: number) => {
    let v = 1;
    el.style.setProperty('--s', '1');
    while (overflows(el) && v > min) {
      v = Math.round((v - 0.02) * 100) / 100;
      el.style.setProperty('--s', String(v));
    }
    return { v, ok: !overflows(el) };
  };
  const first = shrink(sheet, minScale);

  let pages = 1;
  let recipesFit = true;
  const pool = doc.getElementById('recipe-pool');
  const tpl = doc.getElementById('recipe-sheet-tpl') as HTMLTemplateElement | null;
  if (pool && tpl) {
    // Yeniden çalıştırmaya karşı: önceki tarif sayfalarını kaldır, blokları havuza geri al
    // (şablonun içeriği ayrı bir belge parçasıdır, querySelectorAll'a dahil olmaz)
    for (const old of Array.from(doc.querySelectorAll('.rsheet'))) {
      for (const b of Array.from(old.querySelectorAll('.recipe'))) pool.appendChild(b);
      old.remove();
    }
    const blocks = Array.from(pool.querySelectorAll<HTMLElement>('.recipe'));
    let cur: HTMLElement | null = null;
    const newSheet = () => {
      const s = doc.importNode(tpl.content.firstElementChild!, true) as HTMLElement;
      pool.parentNode!.insertBefore(s, pool);
      pages += 1;
      return s;
    };
    for (const block of blocks) {
      if (!cur) cur = newSheet();
      let list = cur.querySelector('.rlist')!;
      list.appendChild(block);
      if (!overflows(cur)) continue;
      if (list.children.length > 1) {
        cur = newSheet();
        list = cur.querySelector('.rlist')!;
        list.appendChild(block);
      }
      if (overflows(cur)) {
        // Tek başına sayfayı aşan tarif: bu sayfayı küçült, sonraki tarif yeni sayfadan başlasın
        if (!shrink(cur, recipeMinScale).ok) recipesFit = false;
        cur = null;
      }
    }
  }
  return { scale: first.v, fits: first.ok, pages, recipesFit };
}
