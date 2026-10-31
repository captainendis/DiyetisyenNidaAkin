/**
 * Beslenme planı PDF üretimi (Chromium / playwright-core).
 * - Tarayıcı ilk istekte açılır, yeniden kullanılır; 5 dk boşta kalınca kapatılır.
 * - Yazı tipi (Manrope) PDF'e gömülür; metin vektördür, telefonda yakınlaştırınca netliğini korur.
 * - Sayfa dış kaynak yükleyemez (tüm istekler engellenir), JavaScript yalnızca sığdırma ölçümü için çalışır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium, type Browser } from 'playwright-core';
import { env } from '../lib/env';
import { renderPlanHtml, fitPlanToPage, MIN_SCALE } from '../../shared/plan-template';
import type { NutritionPlanData } from '../../shared/plan';

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

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

function getBrowser() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const p = browserPromise;
    browserPromise = null;
    void p?.then((b) => b.close()).catch(() => {});
  }, 5 * 60_000);
  browserPromise ??= chromium
    .launch({
      executablePath: env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    })
    .catch((e) => {
      browserPromise = null;
      throw e;
    });
  return browserPromise;
}

export class PdfUnavailableError extends Error {}

export async function renderPlanPdf(plan: NutritionPlanData, title: string) {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    console.error('Chromium başlatılamadı', e);
    throw new PdfUnavailableError('PDF motoru başlatılamadı. Sunucuda Chromium kurulu olmalı (README → PDF).');
  }
  const ctx = await browser.newContext({ javaScriptEnabled: true, offline: true });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', (r) => r.abort());
    await page.setContent(renderPlanHtml(plan, { fontCss: getFontCss(), title }), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const fit = await page.evaluate(
      ([fn, min]) => new Function('doc', 'min', `var __name = function (f) { return f; }; return (${fn})(doc, min)`)(document, min) as { scale: number; fits: boolean },
      [fitPlanToPage.toString(), MIN_SCALE] as const,
    );
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, pageRanges: '1' });
    return { pdf, ...fit };
  } finally {
    await ctx.close();
  }
}
