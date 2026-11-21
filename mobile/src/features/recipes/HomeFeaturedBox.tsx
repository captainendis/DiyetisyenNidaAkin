// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ana sayfadaki "Mutfaktan" şeridinde hangi tariflerin görüneceğini seçme kutusu (web: HomeFeaturedBox).
 * Yalnızca yayındaki, kişiye özel olmayan tarifler seçilebilir; en fazla MAX_FEATURED_RECIPES.
 * Hiç seçim yoksa sitede son yayınlanan tarifler gösterilir.
 */
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Icon, IconButton, SelectField, T, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { queryClient } from '@/lib/query';
import { colors, space } from '@/theme';
import { MAX_FEATURED_RECIPES, RECIPE_CATEGORY_LABEL, type Recipe } from '@shared/recipe';
import { RecipeThumb } from './RecipeCard';

/** Ana sayfa seçimini değiştirir (PUT /recipes/:id/featured) */
export async function setRecipeFeatured(id: string, featured: boolean) {
  const res = await api.put<{ recipe: Recipe }>(`/recipes/${id}/featured`, { featured });
  await queryClient.invalidateQueries({ queryKey: ['recipes'] });
  return res.recipe;
}

export const featuredError = (e: unknown) => (e instanceof ApiError ? Object.values(e.fields)[0] ?? e.message : errorMessage(e));

export function HomeFeaturedBox({ library, editable }: { library: Recipe[]; editable: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const published = library.filter((r) => r.isPublished && !r.clientId);
  // Sitedeki sırayla aynı: seçilme zamanına göre
  const featured = published.filter((r) => r.isFeatured).sort((a, b) => (a.featuredAt ?? '').localeCompare(b.featuredAt ?? ''));
  const candidates = published.filter((r) => !r.isFeatured);
  const fallback = [...published].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, MAX_FEATURED_RECIPES);

  const toggle = async (r: Recipe, on: boolean) => {
    setBusy(r.id);
    try {
      await setRecipeFeatured(r.id, on);
      toast(on ? 'Ana sayfaya eklendi' : 'Ana sayfadan çıkarıldı');
    } catch (e) {
      toast(`Değiştirilemedi: ${featuredError(e)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (!published.length) return null;
  const shown = featured.length ? featured : fallback;

  return (
    <Card style={{ marginBottom: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="home" size={17} color={colors.goldInk} />
        <T variant="heading" style={{ flex: 1 }}>Ana sayfada gösterilenler</T>
        <Badge label={`${featured.length}/${MAX_FEATURED_RECIPES}`} />
      </View>
      <T variant="caption">
        {featured.length
          ? '“Mutfaktan” bölümünde bu sırayla görünür.'
          : 'Henüz seçim yok. Ana sayfada şu an son yayınlanan tarifler görünüyor. Seçtiğiniz anda yalnızca sizin seçtikleriniz görünür.'}
      </T>
      <View style={{ gap: space.sm }}>
        {shown.map((r, i) => (
          <View key={r.id} style={[styles.row, !featured.length && { borderStyle: 'dashed', opacity: 0.75 }]}>
            <T variant="label" color={colors.muted} style={{ width: 14, textAlign: 'center' }}>{i + 1}</T>
            <RecipeThumb recipe={r} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <T variant="subheading" numberOfLines={1}>{r.title}</T>
              <T variant="caption" numberOfLines={1}>{featured.length ? RECIPE_CATEGORY_LABEL[r.category] : 'Otomatik (son yayınlanan)'}</T>
            </View>
            {featured.length > 0 && editable ? (
              busy === r.id ? <ActivityIndicator color={colors.gold} /> : <IconButton name="x" label={`${r.title} ana sayfadan çıkar`} color={colors.muted} onPress={() => void toggle(r, false)} />
            ) : null}
          </View>
        ))}
      </View>
      {editable && featured.length < MAX_FEATURED_RECIPES && candidates.length > 0 ? (
        <SelectField<string>
          value={null}
          placeholder="+ Ana sayfaya tarif ekle"
          disabled={!!busy}
          searchable={candidates.length > 8}
          options={candidates.map((r) => ({ value: r.id, label: r.variantNote ? `${r.title} · ${r.variantNote}` : r.title, description: RECIPE_CATEGORY_LABEL[r.category] }))}
          onChange={(id) => {
            const r = candidates.find((x) => x.id === id);
            if (r) void toggle(r, true);
          }}
        />
      ) : null}
      <Button title="Ana sayfada gör" icon="external-link" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void Linking.openURL(`${SITE_URL}/#recipes-title`)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: space.sm },
  thumb: { width: 56, height: 42, borderRadius: 8 },
});
