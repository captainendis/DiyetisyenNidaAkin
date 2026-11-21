// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Plan: tarif önerileri (ek sayfa). Kütüphaneden seçme, etiket, sıralama, çıkarma ve
 * danışana uyarlama (varyasyon — kaydedilince plandaki tarifin yerini alır). Web: PlanEditorForm RecipesSection.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Sheet, Sortable, T, TextField } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';
import { MAX_PLAN_RECIPES, type NutritionPlanData } from '@shared/plan';
import { RECIPE_CATEGORY_LABEL, RECIPE_DEFAULT_LABEL, recipeMeta, type Recipe } from '@shared/recipe';
import { recipesVisibleFor, type ClientRef } from '@/features/recipes/api';
import { RecipeThumb } from '@/features/recipes/RecipeCard';
import { RecipeFormSheet } from '@/features/recipes/RecipeFormSheet';
import { RecipePickerSheet } from '@/features/recipes/RecipePickerSheet';
import type { PlanSetter } from './api';

export function PlanRecipesSection({
  data,
  set,
  library,
  client,
  editable,
}: {
  data: NutritionPlanData;
  set: PlanSetter;
  library?: Recipe[];
  client?: ClientRef | null;
  editable: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [adapting, setAdapting] = useState<{ index: number; recipe: Recipe } | null>(null);
  const [suggestFor, setSuggestFor] = useState<number | null>(null);
  const items = data.recipes.items;
  const byId = new Map((library ?? []).map((r) => [r.id, r]));
  const mealNames = [...new Set(data.meals.map((m) => m.name.trim()).filter(Boolean))];
  const suggestions = [...new Set([...mealNames.map((n) => `${n} için öneri`), ...Object.values(RECIPE_DEFAULT_LABEL)])];
  /** Kategoriye uyan bir öğün varsa onun adıyla etiketle (ör. "Kahvaltı için öneri") */
  const labelFor = (r: Recipe) => {
    const cat = RECIPE_CATEGORY_LABEL[r.category].toLocaleLowerCase('tr-TR');
    const meal = mealNames.find((n) => n.toLocaleLowerCase('tr-TR').includes(cat));
    return meal ? `${meal} için öneri` : RECIPE_DEFAULT_LABEL[r.category];
  };
  const move = (i: number, to: number) => set((d) => void d.recipes.items.splice(to, 0, d.recipes.items.splice(i, 1)[0]!));

  return (
    <View style={{ gap: space.md }}>
      <T variant="caption">
        {client
          ? `Kütüphaneden seçin ya da ${client.firstName} için uyarlayın; PDF'te planın arkasına fotoğraflarıyla ek sayfa olarak basılır.`
          : "Tarif kütüphanesinden seçin; PDF'te planın arkasına fotoğraflarıyla ek sayfa olarak basılır."}
      </T>
      {items.length > 0 ? (
        <TextField label="Ek sayfa başlığı" value={data.recipes.title} maxLength={60} placeholder="Tarif önerileri" editable={editable} onChange={(v) => set((d) => void (d.recipes.title = v))} />
      ) : null}
      {!items.length ? (
        <Pressable disabled={!editable || !library} onPress={() => setPicking(true)} accessibilityRole="button" style={styles.empty}>
          <Icon name="coffee" size={20} color={colors.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label" color={colors.muted}>Henüz tarif eklenmedi</T>
            <T variant="caption">Ör. kahvaltı için yulaflı tost, ara öğün için kefirli smoothie. Tarifleri “Tarifler” ekranından yönetebilirsiniz.</T>
          </View>
        </Pressable>
      ) : (
        <Sortable
          items={items}
          keyOf={(it, i) => `${it.recipeId}-${i}`}
          gap={space.md}
          enabled={editable}
          labelOf={(it) => byId.get(it.recipeId)?.title ?? 'Tarif'}
          onReorder={move}
          renderItem={(it, i, handle) => {
          const r = byId.get(it.recipeId);
          return (
            <View style={styles.item}>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                {handle}
                {r ? <RecipeThumb recipe={r} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: '#EFE8DD' }]} />}
                <Pressable style={{ flex: 1, gap: 2 }} disabled={!r} onPress={() => r && router.push(`/panel/tarifler/${r.id}`)} accessibilityRole="link">
                  {r ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {r.clientId ? (
                          <View style={styles.personal}>
                            <T style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.espresso }}>Sana özel</T>
                          </View>
                        ) : null}
                        <T variant="subheading" numberOfLines={2} style={{ flexShrink: 1 }}>{r.title}</T>
                      </View>
                      <T variant="caption" numberOfLines={2}>{[r.variantNote || RECIPE_CATEGORY_LABEL[r.category], ...recipeMeta(r).slice(0, 2)].join(' · ')}</T>
                    </>
                  ) : (
                    <T variant="label" color={colors.dangerInk}>{library ? 'Bu tarif silinmiş; PDF’te gösterilmez.' : 'Yükleniyor…'}</T>
                  )}
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xs }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    accessibilityLabel="Tarif etiketi"
                    value={it.label}
                    maxLength={60}
                    placeholder="Kahvaltı için öneri"
                    editable={editable}
                    onChange={(v) => set((d) => void (d.recipes.items[i]!.label = v))}
                  />
                </View>
                {editable ? <IconButton name="list" label="Etiket önerileri" onPress={() => setSuggestFor(i)} /> : null}
              </View>
              {editable ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs }}>
                  {r && !(client && r.clientId === client.id) ? (
                    <Button
                      title={client ? `${client.firstName} için uyarla` : 'Varyasyon oluştur'}
                      icon="git-branch"
                      variant="ghost"
                      size="sm"
                      style={{ marginRight: 'auto', paddingHorizontal: space.sm }}
                      onPress={() => setAdapting({ index: i, recipe: r })}
                    />
                  ) : null}
                  <IconButton name="trash-2" label="Tarifi plandan çıkar" color={colors.dangerInk} onPress={() => set((d) => void d.recipes.items.splice(i, 1))} />
                </View>
              ) : null}
            </View>
          );
          }}
        />
      )}
      {editable && items.length < MAX_PLAN_RECIPES ? (
        <Button title="Tarif ekle" icon="plus" variant="secondary" size="sm" disabled={!library} style={{ alignSelf: 'flex-start' }} onPress={() => setPicking(true)} />
      ) : null}

      <Sheet visible={suggestFor !== null} onClose={() => setSuggestFor(null)} title="Etiket önerileri">
        <View style={styles.list}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => {
                const idx = suggestFor;
                if (idx !== null) set((d) => void (d.recipes.items[idx] && (d.recipes.items[idx]!.label = s)));
                setSuggestFor(null);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.option, i < suggestions.length - 1 && styles.line, pressed && { backgroundColor: '#F8F4EE' }]}
            >
              <T>{s}</T>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {editable ? (
        <RecipeFormSheet
          open={!!adapting}
          onClose={() => setAdapting(null)}
          variantOf={adapting?.recipe ?? null}
          defaultClient={client ?? null}
          onSaved={(v) => {
            const idx = adapting?.index;
            if (idx !== undefined) set((d) => void (d.recipes.items[idx] && (d.recipes.items[idx]!.recipeId = v.id)));
          }}
        />
      ) : null}
      {editable && library ? (
        <RecipePickerSheet
          open={picking}
          onClose={() => setPicking(false)}
          library={recipesVisibleFor(library, client?.id)}
          alreadyAdded={items.map((x) => x.recipeId)}
          limit={MAX_PLAN_RECIPES - items.length}
          onPick={(rs) =>
            set((d) => {
              for (const r of rs) if (d.recipes.items.length < MAX_PLAN_RECIPES) d.recipes.items.push({ recipeId: r.id, label: labelFor(r) });
            })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', gap: space.md, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  item: { gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FBF8F3', padding: space.md },
  thumb: { width: 72, height: 54, borderRadius: 8 },
  personal: { backgroundColor: colors.rose, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  option: { paddingVertical: 14, paddingHorizontal: space.lg },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
