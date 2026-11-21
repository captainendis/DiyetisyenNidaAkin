// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Gerçek A4 önizleme — web'deki PlanPreview ile aynı: yazdırma sayfasının şablonu (shared/plan-template.ts →
 * renderPlanHtml) WebView'de çizilir, ardından aynı sığdırma algoritması (fitPlanToPage) çalıştırılır ve
 * sonuç (ölçek, sayfa sayısı) uygulamaya bildirilir. Sayfa ekran genişliğine ölçeklenir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Loading } from '@/components/ui';
import { API_URL } from '@/lib/config';
import { colors, radius, shadow } from '@/theme';
import { MIN_SCALE, RECIPE_MIN_SCALE, renderPlanHtml, type FitResult } from '@shared/plan-template';
import type { NutritionPlanData } from '@shared/plan';
import { recipeImageUrl, type PrintRecipe, type Recipe } from '@shared/recipe';
import { FIT_PLAN_SOURCE } from './fitScript.generated';

const PAGE_W = 794; // 210mm @96dpi
const PAGE_H = 1123; // 297mm
const GAP = 24; // şablondaki @media screen sayfa aralığı

// Web ile aynı Manrope dosyaları (public/fonts) — göreli yollar baseUrl (API_URL) üzerinden çözülür
const FONT_CSS =
  `@font-face{font-family:'Manrope Variable';font-weight:200 800;src:url(/fonts/manrope-latin-wght-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212;}` +
  `@font-face{font-family:'Manrope Variable';font-weight:200 800;src:url(/fonts/manrope-latin-ext-wght-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2C60-2C7F,U+A720-A7FF;}`;

/** Sayfa yüklenince: yazı tipleri hazır olunca sığdır, sonucu gönder, ekrana ölçekle */
const fitScript = (zoom: number) => `
(function(){
  ${FIT_PLAN_SOURCE}
  function run(){
    try {
      var r = fitPlanToPage(document, ${MIN_SCALE}, ${RECIPE_MIN_SCALE});
      document.documentElement.style.zoom = '${zoom}';
      window.ReactNativeWebView.postMessage(JSON.stringify(r));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: String(e) }));
    }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
})();
true;`;

export function A4Preview({ data, recipes, onFit }: { data: NutritionPlanData; recipes: PrintRecipe[]; onFit?: (r: FitResult | null) => void }) {
  const [width, setWidth] = useState(0);
  const [html, setHtml] = useState('');
  const [pages, setPages] = useState(1);
  const [ready, setReady] = useState(false);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  // Yazarken her değişiklikte yeniden çizmemek için kısa gecikme (web ile aynı)
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderPlanHtml(data, { fontCss: FONT_CSS, recipes })), 250);
    return () => clearTimeout(t);
  }, [data, recipes]);

  useEffect(() => {
    setReady(false);
    onFitRef.current?.(null);
  }, [html]);

  const zoom = width ? width / PAGE_W : 0.45;
  const injected = useMemo(() => fitScript(zoom), [zoom]);
  const height = (PAGE_H * pages + GAP * (pages - 1)) * zoom;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const r = JSON.parse(e.nativeEvent.data) as FitResult & { error?: string };
      if (r.error) return;
      setPages(r.pages);
      setReady(true);
      onFitRef.current?.(r);
    } catch {
      /* yok say */
    }
  };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={{ width: '100%', height: width ? height : 300, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, ...shadow.card }}
      accessibilityLabel={pages > 1 ? `Plan önizlemesi (A4, ${pages} sayfa)` : 'Plan önizlemesi (A4)'}
    >
      {width && html ? (
        <WebView
          key={`${zoom}`}
          originWhitelist={['*']}
          source={{ html, baseUrl: `${API_URL}/` }}
          injectedJavaScript={injected}
          onMessage={onMessage}
          scrollEnabled={false}
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:') || req.url.startsWith(API_URL) || req.navigationType !== 'click'}
          style={{ backgroundColor: '#fff', opacity: ready ? 1 : 0 }}
        />
      ) : null}
      {!ready ? (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Loading label="Önizleme hazırlanıyor…" />
        </View>
      ) : null}
    </View>
  );
}

/** Sığdırma sonucunun açıklaması — web'deki (PlanEditorPage) metinlerle aynı */
export function fitMessage(fit: FitResult | null): { text: string; tone: 'neutral' | 'warning' | 'danger' } {
  if (!fit) return { text: 'Önizleme hazırlanıyor…', tone: 'neutral' };
  if (!fit.fits) return { text: 'İçerik tek sayfaya sığmıyor. Bazı satırları kısaltın ya da bir seçenek/öğün çıkarın.', tone: 'danger' };
  if (fit.scale < 0.85)
    return { text: `Tek sayfaya sığdı ama yazı %${Math.round(fit.scale * 100)} boyuta küçüldü. Telefonda okunur, baskıda küçük kalabilir. Satırları kısaltmayı düşünün.`, tone: 'warning' };
  if (fit.scale < 1) return { text: `Tek sayfaya sığdı · yazı boyutu %${Math.round(fit.scale * 100)} olarak ayarlandı.`, tone: 'neutral' };
  return { text: 'Tek sayfaya sığıyor · tam boyut.', tone: 'neutral' };
}

/** Plana eklenmiş tariflerin yazdırma biçimi (web: components/panel/recipes/api.ts → printRecipesFor) */
export function printRecipesFor(plan: NutritionPlanData, library: Recipe[] | undefined): PrintRecipe[] {
  if (!library) return [];
  const byId = new Map(library.map((r) => [r.id, r]));
  return (plan.recipes?.items ?? []).flatMap((it) => {
    const r = byId.get(it.recipeId);
    if (!r) return [];
    return [{
      title: r.title, category: r.category, summary: r.summary, servings: r.servings, prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes, kcal: r.kcal, ingredients: r.ingredients, steps: r.steps, tip: r.tip,
      variantNote: r.variantNote, personal: !!r.clientId, label: it.label,
      image: r.imageBase ? recipeImageUrl(r.imageBase, 480) : null,
    }];
  });
}
