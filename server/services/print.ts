// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planı yazdırma sayfası — sunucuda PDF üretilmez (Chromium gerekmez).
 * Plan, panel önizlemesiyle aynı şablonla (shared/plan-template.ts) bağımsız bir A4 HTML belgesi olarak döner;
 * tarayıcı sayfayı A4'e sığdırır ve yazdırma penceresini açar. Kullanıcı "PDF olarak kaydet" ile PDF alır.
 * - Yazı tipi (Manrope) belgeye gömülür; dış kaynak yüklenmez.
 * - Belgedeki tek betik nonce ile izinlidir (sayfaya özel sıkı CSP).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { renderPlanHtml, fitPlanToPage, MIN_SCALE, RECIPE_MIN_SCALE } from '../../shared/plan-template';
import type { NutritionPlanData } from '../../shared/plan';
import type { PrintRecipe } from '../../shared/recipe';

const require = createRequire(import.meta.url);

let fontCss: string | null = null;
function getFontCss() {
  if (fontCss) return fontCss;
  const dir = path.join(path.dirname(require.resolve('@fontsource-variable/manrope/package.json')), 'files');
  const face = (file: string, range: string) => {
    const data = fs.readFileSync(path.join(dir, file)).toString('base64');
    return `@font-face{font-family:'Manrope Variable';font-style:normal;font-weight:200 800;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`;
  };
  fontCss =
    face('manrope-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD') +
    face('manrope-latin-ext-wght-normal.woff2', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF');
  return fontCss;
}

const TOOLBAR_CSS = `
.print-bar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 16px;
  padding:12px 16px;background:#211710;color:#F6F1EA;font:500 14px/1.4 'Manrope Variable',system-ui,sans-serif}
.print-bar button{font:inherit;font-weight:700;padding:10px 20px;border:0;border-radius:999px;background:#F6F1EA;color:#211710;cursor:pointer}
.print-bar button:focus-visible{outline:3px solid #E9B7A6;outline-offset:2px}
.print-bar small{opacity:.85}
@media print{.print-bar{display:none!important}}`;

export interface PrintPage {
  html: string;
  /** Yanıtın Content-Security-Policy başlığı (betik yalnızca bu nonce ile çalışır) */
  csp: string;
}

export function renderPlanPrintPage(plan: NutritionPlanData, title: string, recipes: PrintRecipe[] = [], opts: { autoPrint?: boolean } = {}): PrintPage {
  const nonce = crypto.randomBytes(16).toString('base64');
  const base = renderPlanHtml(plan, { fontCss: getFontCss() + TOOLBAR_CSS, title, recipes });
  const bar = `<div class="print-bar" role="region" aria-label="Yazdırma">
  <button type="button" id="print-btn">Yazdır / PDF olarak kaydet</button>
  <small>PDF için hedef olarak “PDF olarak kaydet”i seçin · Kenar boşlukları: Yok · Arka plan grafikleri: Açık</small>
</div>`;
  // fitPlanToPage derlenirken esbuild/tsx yardımcı __name eklenebilir; boş bir tanım sağlanır.
  const script = `<script nonce="${nonce}">(function(){var __name=function(f){return f};
var fit=(${fitPlanToPage.toString()});
var done=false;function run(){fit(document,${MIN_SCALE},${RECIPE_MIN_SCALE});done=true}
var ready=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
ready.then(function(){run();${opts.autoPrint ? 'setTimeout(function(){window.print()},150);' : ''}});
document.getElementById('print-btn').addEventListener('click',function(){if(!done)run();window.print()});
})();</script>`;
  const html = base.replace(/<body([^>]*)>/, `<body$1>${bar}`).replace('</body>', `${script}</body>`);
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    'img-src data:',
    'font-src data:',
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return { html, csp };
}
