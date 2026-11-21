// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarifler (web: PortalRecipesPage) — listelerine eklenen ve sana özel hazırlanan tarifler */
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { RECIPE_CATEGORY_LABEL } from '@shared/recipe';
import type { PortalRecipeCard } from '@shared/portal';
import { Badge, Button, Empty, QueryView, Screen, T } from '@/components/ui';
import { PK, recipeImage } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { useApiQuery } from '@/lib/query';
import { colors, radius, shadow, space } from '@/theme';
import * as WebBrowser from 'expo-web-browser';

export default function RecipesScreen() {
  const q = useApiQuery(PK.recipes, () => portalApi.get<{ items: PortalRecipeCard[] }>('/recipes'));
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Tarifler' }} />
      <T muted style={{ marginBottom: space.sm }}>Listelerine eklenen ve sana özel hazırlanan tarifler.</T>
      <Button
        title="Herkese açık tarifler"
        variant="ghost"
        size="sm"
        icon="external-link"
        onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/tarifler`)}
        style={{ alignSelf: 'flex-start', marginBottom: space.lg, paddingHorizontal: 0 }}
      />
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Empty icon="book" title="Henüz sana eklenmiş tarif yok." text="Diyetisyenin listene tarif eklediğinde burada görünecek." />
          ) : (
            <View style={{ gap: space.lg }}>
              {data.items.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/hesabim/tarifler/${r.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={r.title}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  {r.imageBase ? <Image source={{ uri: recipeImage(r.imageBase, 960) }} style={styles.img} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : null}
                  <View style={{ padding: space.lg, gap: 4 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                      <T variant="label" color={colors.muted}>{RECIPE_CATEGORY_LABEL[r.category]}</T>
                      {r.personal ? <Badge label="Sana özel" tone="rose" /> : null}
                    </View>
                    <T variant="title" style={{ fontSize: 24, lineHeight: 28 }}>{r.title}</T>
                    {r.variantNote ? <T variant="label" color={colors.roseInk}>{r.variantNote}</T> : null}
                    {r.inPlans.length > 0 ? <T variant="caption">{r.inPlans.join(', ')}</T> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  img: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.sand },
});
