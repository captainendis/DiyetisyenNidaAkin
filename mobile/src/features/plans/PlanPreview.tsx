// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Planın telefona uyarlanmış canlı önizlemesi — A4 şablonunun (shared/plan-template.ts) bölümleri, temanın
 * gerçek renkleriyle aynı sırada çizilir. Kesin sayfa düzeni (tek sayfaya sığdırma, tarif sayfaları) için
 * "PDF" ile sunucunun yazdırma sayfası kullanılır.
 */
import { StyleSheet, View } from 'react-native';
import { Icon, T } from '@/components/ui';
import { fonts, radius, space } from '@/theme';
import { PLAN_THEMES, type NutritionPlanData } from '@shared/plan';
import { RECIPE_CATEGORY_LABEL, recipeMeta, type Recipe } from '@shared/recipe';
import { RecipeThumb } from '@/features/recipes/RecipeCard';

const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

export function PlanPreview({ data, library }: { data: NutritionPlanData; library?: Recipe[] }) {
  const t = (PLAN_THEMES[data.theme] ?? PLAN_THEMES.green).colors;
  const byId = new Map((library ?? []).map((r) => [r.id, r]));
  const recipes = data.recipes.items.flatMap((it) => {
    const r = byId.get(it.recipeId);
    return r ? [{ r, label: it.label }] : [];
  });
  const recipesTitle = data.recipes.title.trim() || 'Tarif önerileri';
  const glasses = data.water.glasses;
  const cardBorder = t.card.toLowerCase() === t.bg.toLowerCase() ? { borderWidth: 1, borderColor: t.line } : null;
  const ink = (style?: object) => [{ color: t.ink }, style];

  return (
    <View style={{ gap: space.lg }}>
      <View style={[styles.sheet, { backgroundColor: t.bg }, t.bg.toLowerCase() === '#ffffff' && { borderWidth: 1, borderColor: t.line }]}>
        {/* Başlık + takip alanları */}
        <T style={ink({ fontFamily: fonts.bold, fontSize: 26, lineHeight: 29, letterSpacing: -0.4 })}>{data.title.replace(/'/g, '’')}</T>
        {data.water.show && (data.water.liters || glasses) ? (
          <View style={[styles.tracker, { backgroundColor: t.chip }]}>
            <T style={ink({ fontFamily: fonts.bold, fontSize: 13 })}>
              Su{data.water.liters ? `, ${data.water.liters} litre` : ''}
              {glasses ? <T style={{ color: t.muted, fontFamily: fonts.medium, fontSize: 12 }}>{`  ${glasses} bardak${data.water.glassMl ? ` × ${data.water.glassMl} ml` : ''}`}</T> : null}
            </T>
            {glasses ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {Array.from({ length: glasses }, (_, i) => (
                  <View key={i} style={[styles.cup, { borderColor: t.ink }]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {data.activity.show && data.activity.label ? (
          <View style={[styles.tracker, { backgroundColor: t.chip }]}>
            <T style={ink({ fontFamily: fonts.bold, fontSize: 13 })}>{data.activity.label}</T>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {WEEKDAYS.map((d) => (
                <View key={d} style={[styles.day, { borderColor: t.line, backgroundColor: t.card }]}>
                  <T style={{ color: t.muted, fontSize: 11, fontFamily: fonts.semibold }}>{d}</T>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {data.subtitle || recipes.length ? (
          <T style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>
            {data.subtitle}
            {recipes.length ? <T style={{ color: t.ink, fontFamily: fonts.semibold, fontSize: 13 }}>{`${data.subtitle ? ' ' : ''}${recipesTitle} sonraki sayfada.`}</T> : null}
          </T>
        ) : null}

        {/* Öğünler */}
        {data.meals.map((m, mi) => (
          <View key={mi} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.dot, { backgroundColor: t.accent, borderColor: t.ink }]} />
              <T style={ink({ fontFamily: fonts.bold, fontSize: 14 })}>{m.time}</T>
              <T style={{ color: t.muted, fontFamily: fonts.semibold, fontSize: 13, flex: 1 }} numberOfLines={1}>{m.name}</T>
            </View>
            <View style={[styles.card, { backgroundColor: t.card }, cardBorder]}>
              {m.options.map((o, oi) => (
                <View key={oi} style={[{ gap: 2 }, oi > 0 && { borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }]}>
                  {m.options.length > 1 ? <T style={{ color: t.muted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }}>{oi + 1}. seçenek</T> : null}
                  {o.filter((l) => l.trim()).map((l, li) => (
                    <T key={li} style={ink({ fontSize: 13, lineHeight: 18 })}>• {l}</T>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Alışkanlıklar + porsiyonlar */}
        {data.habits.items.length ? (
          <View style={[styles.card, { backgroundColor: t.dark }]}>
            {data.habits.title ? <T style={{ color: t.darkAccent, fontFamily: fonts.bold, fontSize: 15 }}>{data.habits.title}</T> : null}
            {data.habits.items.map((h, i) => (
              <T key={i} style={{ color: t.darkInk, fontSize: 13, lineHeight: 18 }}>
                <T style={{ color: t.darkInk, fontFamily: fonts.bold, fontSize: 13 }}>{h.title}</T> {h.text}
              </T>
            ))}
          </View>
        ) : null}
        {data.portions.items.length ? (
          <View style={{ gap: 6 }}>
            {data.portions.title ? <T style={ink({ fontFamily: fonts.bold, fontSize: 15 })}>{data.portions.title}</T> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.portions.items.map((p, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: t.chip }]}>
                  <T style={ink({ fontFamily: fonts.bold, fontSize: 12 })}>{p.name}</T>
                  <T style={{ color: t.muted, fontSize: 12 }}>{p.amount}</T>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.foot, { borderTopColor: t.line }]}>
          {data.footerNote ? <T style={{ color: t.muted, fontSize: 12, flex: 1 }}>{data.footerNote}</T> : <View style={{ flex: 1 }} />}
          {data.signature ? <T style={ink({ fontFamily: fonts.semibold, fontSize: 12 })}>{data.signature}</T> : null}
        </View>
      </View>

      {recipes.length ? (
        <View style={[styles.sheet, { backgroundColor: t.bg }, t.bg.toLowerCase() === '#ffffff' && { borderWidth: 1, borderColor: t.line }]}>
          <T style={ink({ fontFamily: fonts.bold, fontSize: 22, lineHeight: 26 })}>{recipesTitle}</T>
          <T style={{ color: t.muted, fontSize: 12 }}>{data.title}</T>
          {recipes.map(({ r, label }, i) => (
            <View key={`${r.id}-${i}`} style={[styles.card, { backgroundColor: t.card }, cardBorder]}>
              <RecipeThumb recipe={r} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {label ? <T style={{ backgroundColor: t.accent, color: t.ink, fontFamily: fonts.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' }}>{label}</T> : null}
                {r.clientId ? <T style={ink({ fontFamily: fonts.bold, fontSize: 11 })}>Sana özel</T> : null}
              </View>
              <T style={ink({ fontFamily: fonts.bold, fontSize: 17 })}>{r.title}</T>
              {r.variantNote ? <T style={ink({ fontFamily: fonts.semibold, fontSize: 12 })}>{r.variantNote}</T> : null}
              {r.summary ? <T style={{ color: t.muted, fontSize: 13 }}>{r.summary}</T> : null}
              <T style={{ color: t.muted, fontSize: 12 }}>{[RECIPE_CATEGORY_LABEL[r.category], ...recipeMeta(r)].join(' · ')}</T>
              <T style={ink({ fontFamily: fonts.bold, fontSize: 13 })}>Malzemeler</T>
              {r.ingredients.map((l, li) => (
                <T key={li} style={ink({ fontSize: 13, lineHeight: 18 })}>• {l}</T>
              ))}
              <T style={ink({ fontFamily: fonts.bold, fontSize: 13 })}>Hazırlanışı</T>
              {r.steps.map((s, si) => (
                <T key={si} style={ink({ fontSize: 13, lineHeight: 18 })}>{si + 1}. {s}</T>
              ))}
              {r.tip ? <T style={{ color: t.muted, fontSize: 12, fontStyle: 'italic' }}>{r.tip}</T> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <Icon name="info" size={15} color="#6B5C50" />
        <T variant="caption" style={{ flex: 1 }}>
          Telefona uyarlanmış önizleme. A4 sayfa düzeni (tek sayfaya sığdırma, tarif ek sayfaları) PDF'te görünür; PDF yazdırma sayfasıyla aynıdır.
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  tracker: { borderRadius: radius.md, padding: space.md, gap: 8 },
  cup: { width: 12, height: 16, borderWidth: 1.2, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  day: { flex: 1, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  card: { borderRadius: radius.md, padding: space.md, gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: '30%' },
  foot: { borderTopWidth: 1, paddingTop: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'flex-end' },
});
