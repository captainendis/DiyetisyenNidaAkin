// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif ayrıntısı + düzenle / varyasyon oluştur / sil / ana sayfada göster (web: RecipeFormModal ve kart) */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, confirm, Empty, IconButton, ListItem, QueryView, Screen, Section, SwitchField, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { MAX_FEATURED_RECIPES, RECIPE_CATEGORY_LABEL, recipeDisplayName, recipeMeta, type Recipe } from '@shared/recipe';
import { useRecipeLibrary } from '@/features/recipes/api';
import { DietNotes } from '@/features/recipes/DietBadges';
import { featuredError, setRecipeFeatured } from '@/features/recipes/HomeFeaturedBox';
import { RecipeBadges, RecipeThumb } from '@/features/recipes/RecipeCard';
import { RecipeFormSheet } from '@/features/recipes/RecipeFormSheet';

function Detail({ recipe }: { recipe: Recipe }) {
  const { can } = useStaff();
  const editable = can('clinical:write');
  const toast = useToast();
  const library = useRecipeLibrary();
  const [sheet, setSheet] = useState<'edit' | 'variant' | null>(null);
  const [busy, setBusy] = useState(false);
  const rootId = recipe.parentId ?? recipe.id;
  const siblings = (library.data?.items ?? []).filter((r) => r.id !== recipe.id && (r.parentId === rootId || r.id === rootId));
  const meta = recipeMeta(recipe);

  const remove = async () => {
    const ok = await confirm({
      title: 'Tarif silinsin mi?',
      message: `Bu tarifi ek sayfasında kullanan planlardan da kaldırılır${recipe.isPublished ? ' ve web sitesinden kalkar' : ''}.${recipe.variantCount ? ` ${recipe.variantCount} varyasyonu bağımsız tarif olarak kalır.` : ''} İşlem geri alınamaz.`,
      confirmText: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del(`/recipes/${recipe.id}`);
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast('Tarif silindi');
      router.back();
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
    }
  };

  const toggleFeatured = async (on: boolean) => {
    setBusy(true);
    try {
      await setRecipeFeatured(recipe.id, on);
      toast(on ? 'Ana sayfaya eklendi' : 'Ana sayfadan çıkarıldı');
    } catch (e) {
      toast(`Değiştirilemedi: ${featuredError(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: recipe.title,
          headerRight: editable ? () => <IconButton name="edit-2" label="Tarifi düzenle" onPress={() => setSheet('edit')} /> : undefined,
        }}
      />
      <Card padded={false} style={{ overflow: 'hidden', marginBottom: space.lg }}>
        <RecipeThumb recipe={recipe} size={960} style={{ width: '100%', aspectRatio: 4 / 3 }} />
        <RecipeBadges recipe={recipe} style={{ position: 'absolute', top: 10, left: 10, right: 10 }} />
        <View style={{ padding: space.lg, gap: space.sm }}>
          <T variant="overline">{RECIPE_CATEGORY_LABEL[recipe.category]}</T>
          <T variant="title">{recipe.title}</T>
          {recipe.client || recipe.variantNote ? (
            <T weight="semibold" color={colors.cocoa}>
              {[recipe.client ? `${recipe.client.firstName} ${recipe.client.lastName} için` : '', recipe.variantNote].filter(Boolean).join(' · ')}
            </T>
          ) : null}
          {recipe.summary ? <T muted>{recipe.summary}</T> : null}
          {meta.length ? <T variant="caption">{meta.join(' · ')}</T> : null}
        </View>
      </Card>

      {editable ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
          <Button title="Düzenle" icon="edit-2" style={{ flex: 1 }} onPress={() => setSheet('edit')} />
          <Button title="Varyasyon oluştur" icon="git-branch" variant="secondary" style={{ flex: 1.3 }} onPress={() => setSheet('variant')} />
        </View>
      ) : null}

      {recipe.dietTags.length ? (
        <Section title="Diyet türü">
          <Card>
            <DietNotes tags={recipe.dietTags} />
          </Card>
        </Section>
      ) : null}

      <Section title="Malzemeler">
        <Card style={{ gap: 6 }}>
          {recipe.ingredients.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
              <T color={colors.goldInk}>•</T>
              <T style={{ flex: 1 }}>{l}</T>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Hazırlanışı">
        <Card style={{ gap: space.md }}>
          {recipe.steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
              <T weight="bold" color={colors.goldInk} style={{ width: 20 }}>{i + 1}.</T>
              <T style={{ flex: 1 }}>{s}</T>
            </View>
          ))}
        </Card>
      </Section>

      {recipe.tip ? (
        <Section title="İpucu">
          <Card>
            <T>{recipe.tip}</T>
          </Card>
        </Section>
      ) : null}

      <Section title="Yayın">
        <Card style={{ gap: space.sm }}>
          <T>
            {recipe.client
              ? 'Kişiye özel tarifler web sitesinde yayınlanamaz; yalnızca bu danışanın planlarında önerilir.'
              : recipe.isPublished
                ? 'Sitedeki “Tarifler” bölümünde herkes görebilir.'
                : 'Yayında değil; yalnızca panelde ve planlarda kullanılır. Yayınlamak için tarifi düzenleyin.'}
          </T>
          {recipe.isPublished && !recipe.client ? (
            <SwitchField
              label="Ana sayfada göster"
              help={`Ana sayfadaki “Mutfaktan” bölümünde öne çıkar (en fazla ${MAX_FEATURED_RECIPES} tarif).`}
              value={recipe.isFeatured}
              disabled={!editable || busy}
              onChange={(v) => void toggleFeatured(v)}
            />
          ) : null}
          {recipe.isPublished && recipe.slug ? (
            <Button title="Sitede görüntüle" icon="external-link" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void Linking.openURL(`${SITE_URL}/tarifler/${recipe.slug}`)} />
          ) : null}
        </Card>
      </Section>

      <Section title="Bağlantılar">
        <Card padded={false}>
          {recipe.parent ? (
            <ListItem icon="corner-left-up" title="Ana tarif" subtitle={recipe.parent.title} onPress={() => router.push(`/panel/tarifler/${recipe.parent!.id}`)} />
          ) : null}
          {recipe.client ? (
            <ListItem icon="user" title="Danışan" subtitle={`${recipe.client.firstName} ${recipe.client.lastName}`} onPress={() => router.push(`/panel/danisanlar/${recipe.client!.id}`)} />
          ) : null}
          {siblings.slice(0, 8).map((r) => (
            <ListItem key={r.id} icon="git-branch" title={recipeDisplayName(r)} subtitle={r.id === rootId ? 'Ana tarif' : 'Varyasyon'} onPress={() => router.push(`/panel/tarifler/${r.id}`)} />
          ))}
          <ListItem
            icon="list"
            title="Tarif ve tüm varyasyonları"
            subtitle={recipe.variantCount ? `${recipe.variantCount} varyasyon` : undefined}
            onPress={() => router.push(`/panel/tarifler?ana=${rootId}`)}
            last
          />
        </Card>
      </Section>

      {editable ? <Button title="Tarifi sil" icon="trash-2" variant="danger" onPress={() => void remove()} /> : null}

      {editable ? (
        <RecipeFormSheet
          open={!!sheet}
          onClose={() => setSheet(null)}
          recipe={sheet === 'edit' ? recipe : null}
          variantOf={sheet === 'variant' ? recipe : null}
          onSaved={(r) => {
            if (sheet === 'variant') setTimeout(() => router.push(`/panel/tarifler/${r.id}`), 350);
          }}
        />
      ) : null}
    </>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useStaff();
  const allowed = can('clinical:read');
  const q = useApiQuery(['recipes', id], () => api.get<{ recipe: Recipe }>(`/recipes/${id}`), { enabled: allowed && !!id });
  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tarif' }} />
        <Empty icon="lock" title="Erişim yok" text="Tarifleri görmek için klinik kayıt okuma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Tarif' }} />
      <QueryView query={q}>{(d) => <Detail recipe={d.recipe} />}</QueryView>
    </Screen>
  );
}
