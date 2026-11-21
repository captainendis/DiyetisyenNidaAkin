// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif ayrıntısı (web: PortalRecipePage) */
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { DIET_TAG_LABEL, DIET_TAG_NOTE, RECIPE_CATEGORY_LABEL, visibleDietTags } from '@shared/recipe';
import type { PortalRecipe } from '@shared/portal';
import { Button, Card, Empty, ErrorView, Icon, Loading, Screen, Section, T } from '@/components/ui';
import { PK, recipeImage } from '@/features/portal/util';
import { ApiError, portalApi } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';

export default function RecipeDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery(PK.recipe(id), () => portalApi.get<{ recipe: PortalRecipe }>(`/recipes/${id}`), { enabled: !!id });
  const r = q.data?.recipe;

  if (q.isPending) return <><Stack.Screen options={{ title: 'Tarif' }} /><Loading /></>;
  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tarif bulunamadı' }} />
        <Empty icon="book" title="Bu tarif artık listende yok." action={<Button title="Tarifler" variant="secondary" onPress={() => router.replace('/hesabim/tarifler')} />} />
      </Screen>
    );
  }
  if (q.error || !r) return <><Stack.Screen options={{ title: 'Tarif' }} /><ErrorView error={q.error} onRetry={() => void q.refetch()} /></>;

  const facts = [
    r.servings ? ['Porsiyon', String(r.servings)] : null,
    r.prepMinutes ? ['Hazırlık', `${r.prepMinutes} dk`] : null,
    r.cookMinutes ? ['Pişirme', `${r.cookMinutes} dk`] : null,
    r.kcal ? ['Porsiyonu', `~${r.kcal} kcal`] : null,
  ].filter((x): x is string[] => !!x);
  const tags = visibleDietTags(r.dietTags);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: r.title }} />
      <View style={{ gap: 6, marginBottom: space.lg }}>
        <T variant="label" color={colors.muted}>{RECIPE_CATEGORY_LABEL[r.category]}{r.personal ? ' · sana özel' : ''}</T>
        <T variant="display">{r.title}</T>
        {r.variantNote ? <T variant="subheading" color={colors.roseInk}>{r.variantNote}</T> : null}
        {r.summary ? <T color={colors.cocoa}>{r.summary}</T> : null}
      </View>

      {r.imageBase ? <Image source={{ uri: recipeImage(r.imageBase, 960) }} style={styles.img} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : null}

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={styles.fact}>
              <T variant="label" color={colors.muted}>{k}</T>
              <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.text }}>{v}</T>
            </View>
          ))}
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={{ gap: space.md, marginBottom: space.xl }}>
          {tags.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <Icon name="check-circle" size={20} color={colors.goldInk} />
              <T variant="caption" color={colors.cocoa} style={{ flex: 1 }}>
                <T variant="label">{DIET_TAG_LABEL[t]}. </T>
                {DIET_TAG_NOTE[t]}
              </T>
            </View>
          ))}
        </View>
      ) : null}

      <Section title="Malzemeler">
        <Card padded={false}>
          {r.ingredients.map((i, k) => (
            <View key={k} style={[styles.ing, k < r.ingredients.length - 1 && styles.line]}>
              <T>{i}</T>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Hazırlanışı">
        <Card>
          <View style={{ gap: space.lg }}>
            {r.steps.map((s, k) => (
              <View key={k} style={{ flexDirection: 'row', gap: space.md }}>
                <View style={styles.step}>
                  <T style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text }}>{k + 1}</T>
                </View>
                <T color={colors.cocoa} style={{ flex: 1, paddingTop: 4 }}>{s}</T>
              </View>
            ))}
          </View>
          {r.tip ? (
            <View style={styles.tip}>
              <T><T style={{ fontFamily: fonts.semibold }}>İpucu. </T>{r.tip}</T>
            </View>
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.sand, marginBottom: space.lg },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl },
  fact: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: 4 },
  ing: { paddingHorizontal: space.lg, paddingVertical: 12 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(33,23,16,0.3)', alignItems: 'center', justifyContent: 'center' },
  tip: { marginTop: space.xl, backgroundColor: 'rgba(244,235,221,0.7)', borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
