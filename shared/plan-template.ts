// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planı — tek sayfa A4 HTML şablonu.
 * Aynı şablon paneldeki canlı önizlemede (iframe srcdoc) ve sunucudaki PDF üretiminde (Chromium) kullanılır.
 *
 * Telefonda okunabilirlik: PDF vektör metin içerir (yakınlaştırınca bulanıklaşmaz), yazı boyutları
 * A4 baskıda da rahat okunacak şekilde seçilmiştir. İçerik uzarsa fitPlanToPage() tüm ölçüleri
 * orantılı küçültür; MIN_SCALE altına inmesi gerekirse "sığmıyor" sonucu döner.
 */
import type { NutritionPlanData } from './plan';

export const MIN_SCALE = 0.72;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const THEMES = {
  green: { bg: '#EDF0E5', ink: '#1E3326', muted: '#5D6B60', accent: '#E3AE1E', card: '#FFFFFF', chip: '#E6EBDD', line: '#C7CFBD', dark: '#1F3326', darkInk: '#F1F3EC', darkAccent: '#E9B728' },
  brand: { bg: '#F6EFE4', ink: '#2A1D14', muted: '#7A6555', accent: '#C99282', card: '#FFFDF9', chip: '#EFE5D6', line: '#DCCDB8', dark: '#302219', darkInk: '#F4EBDD', darkAccent: '#DDAFA0' },
} as const;

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const CUP = `<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 1h10l-1.3 13.2a1 1 0 0 1-1 .8H3.3a1 1 0 0 1-1-.8L1 1Z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

export function renderPlanHtml(plan: NutritionPlanData, opts: { fontCss: string; title?: string }) {
  const t = THEMES[plan.theme] ?? THEMES.green;
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
      ${plan.subtitle ? `<p class="sub">${esc(plan.subtitle)}</p>` : ''}
    </header>`;

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
.card { background: ${t.card}; border-radius: 3.5mm; padding: calc(3.2mm * var(--s)) calc(4mm * var(--s)); display: grid; gap: 0 calc(4mm * var(--s)); }
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
.portions { background: ${t.card}; border-radius: 3.5mm; padding: calc(5mm * var(--s)) calc(5mm * var(--s)); }
.chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2mm; }
.chip { background: ${t.chip}; border-radius: 2mm; padding: calc(1.8mm * var(--s)) calc(2.4mm * var(--s)); }
.chip b { display: block; font-size: calc(9.6pt * var(--s)); font-weight: 800; }
.chip span { display: block; font-size: calc(8.6pt * var(--s)); color: ${t.muted}; font-weight: 500; }
.foot { margin-top: auto; padding-top: calc(3mm * var(--s)); display: flex; justify-content: space-between; gap: 6mm; font-size: calc(8.8pt * var(--s)); color: ${t.muted}; font-weight: 500; }
.foot .sig { white-space: nowrap; }
</style></head>
<body><main class="sheet" id="sheet"><div class="content" id="content">
${header}
<div class="timeline">${meals}</div>
${bottom}
</div>
<footer class="foot"><span>${esc(plan.footerNote)}</span>${plan.signature ? `<span class="sig">${esc(plan.signature)}</span>` : ''}</footer>
</main></body></html>`;
}

/**
 * Sayfaya sığdırma: içerik A4'ten taşıyorsa ölçeği adım adım küçültür.
 * Hem tarayıcıda (önizleme) hem Chromium'da (PDF) çalışır; dış değişken kullanmaz
 * (page.evaluate ile serileştirilebilmesi için).
 */
export function fitPlanToPage(doc: Document, minScale: number): { scale: number; fits: boolean } {
  const sheet = doc.getElementById('sheet') as HTMLElement | null;
  if (!sheet) return { scale: 1, fits: true };
  const overflows = () => sheet.scrollHeight > sheet.clientHeight + 1;
  let s = 1;
  sheet.style.setProperty('--s', '1');
  while (overflows() && s > minScale) {
    s = Math.round((s - 0.02) * 100) / 100;
    sheet.style.setProperty('--s', String(s));
  }
  return { scale: s, fits: !overflows() };
}
