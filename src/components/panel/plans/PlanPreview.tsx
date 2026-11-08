// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Canlı A4 önizleme — PDF ile aynı şablon (shared/plan-template.ts).
 * iframe srcdoc betik çalıştırmaz; sayfaya sığdırma ölçümü üst pencereden yapılır.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import latinUrl from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import latinExtUrl from '@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2?url';
import { fitPlanToPage, MIN_SCALE, RECIPE_MIN_SCALE, renderPlanHtml, type FitResult } from '@shared/plan-template';
import type { NutritionPlanData } from '@shared/plan';
import type { PrintRecipe } from '@shared/recipe';

const FONT_CSS =
  `@font-face{font-family:'Manrope Variable';font-weight:200 800;src:url(${latinUrl}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212;}` +
  `@font-face{font-family:'Manrope Variable';font-weight:200 800;src:url(${latinExtUrl}) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2C60-2C7F,U+A720-A7FF;}`;

const PAGE_W = 794; // 210mm @96dpi
const PAGE_H = 1123; // 297mm
const GAP = 24; // sayfalar arası ekran boşluğu (şablondaki @media screen ile aynı)

export function PlanPreview({ data, recipes = [], onFit }: { data: NutritionPlanData; recipes?: PrintRecipe[]; onFit?: (r: FitResult) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [html, setHtml] = useState('');
  const [pages, setPages] = useState(1);

  // Yazarken her tuşta yeniden çizmemek için kısa gecikme
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderPlanHtml(data, { fontCss: FONT_CSS, recipes })), 180);
    return () => clearTimeout(t);
  }, [data, recipes]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(el.clientWidth / PAGE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const run = () => {
      const r = fitPlanToPage(doc, MIN_SCALE, RECIPE_MIN_SCALE);
      setPages(r.pages);
      onFit?.(r);
    };
    if (doc.fonts?.ready) void doc.fonts.ready.then(run);
    else run();
  };

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg shadow-[0_12px_40px_-18px_rgba(33,23,16,0.45)] ring-1 ring-panel-line" style={{ height: (PAGE_H * pages + GAP * (pages - 1)) * zoom }}>
      <iframe
        ref={frame}
        title={pages > 1 ? `Plan önizlemesi (A4, ${pages} sayfa)` : 'Plan önizlemesi (A4)'}
        srcDoc={html}
        onLoad={measure}
        sandbox="allow-same-origin"
        className="absolute top-0 left-0 origin-top-left border-0 bg-white"
        style={{ width: PAGE_W, height: PAGE_H * pages + GAP * (pages - 1), transform: `scale(${zoom})` }}
      />
    </div>
  );
}
