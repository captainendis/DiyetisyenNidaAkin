// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif kütüphanesi (web: /panel/tarifler). Planlara ek sayfa olarak eklenir; "Web sitesinde yayınla" işaretlenenler
 * sitede /tarifler altında görünür. ?danisan=<id> bir danışanın tarifleri, ?ana=<id> bir tarif ve varyasyonları,
 * ?kapsam=genel|yayinda|kisiye-ozel, ?kategori=<KATEGORI>.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Empty, Fab, Grid, Icon, QueryView, Screen, Segmented, SelectField, T, TextField } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { colors, fonts, radius, space } from '@/theme';
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, type Recipe, type RecipeCategory } from '@shared/recipe';
import { normTr, useRecipeLibrary } from '@/features/recipes/api';
import { HomeFeaturedBox } from '@/features/recipes/HomeFeaturedBox';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { RecipeFormSheet } from '@/features/recipes/RecipeFormSheet';

type Scope = 'tumu' | 'genel' | 'yayinda' | 'kisiye-ozel';
const SCOPES: Scope[] = ['tumu', 'genel', 'yayinda', 'kisiye-ozel'];

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={`${label} süzgecini kaldır`} style={styles.pill}>
      <T style={{ color: colors.ivory, fontFamily: fonts.semibold, fontSize: 13 }} numberOfLines={1}>{label}</T>
      <Icon name="x" size={14} color={colors.ivory} />
    </Pressable>
  );
}

function Library({ all }: { all: Recipe[] }) {
  const params = useLocalSearchParams<{ kategori?: string; kapsam?: string; danisan?: string; ana?: string }>();
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(params.kategori ?? '') ? (params.kategori as RecipeCategory) : '';
  const scope = SCOPES.find((s) => s === params.kapsam) ?? 'tumu';
  const clientFilter = params.danisan || null;
  const parentFilter = params.ana || null;
  const [q, setQ] = useState('');
  const { can } = useStaff();
  const editable = can('clinical:write');
  const setParam = (k: string, v: string | null) => router.setParams({ [k]: v ?? undefined });

  const inScope = (r: Recipe) =>
    (scope === 'tumu' || (scope === 'genel' && !r.clientId) || (scope === 'yayinda' && r.isPublished) || (scope === 'kisiye-ozel' && !!r.clientId)) &&
    (!clientFilter || r.clientId === clientFilter) &&
    (!parentFilter || r.id === parentFilter || r.parentId === parentFilter);
  const scoped = all.filter(inScope);
  const counts = useMemo(() => {
    const c: Partial<Record<RecipeCategory | '', number>> = { '': scoped.length };
    for (const r of scoped) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [scoped]);
  const needle = normTr(q.trim());
  const items = scoped.filter(
    (r) =>
      (!category || r.category === category) &&
      (!needle || normTr(`${r.title} ${r.summary} ${r.variantNote} ${r.ingredients.join(' ')} ${r.client ? `${r.client.firstName} ${r.client.lastName}` : ''}`).includes(needle)),
  );
  const filterClient = clientFilter ? all.find((r) => r.clientId === clientFilter)?.client : null;
  const filterParent = parentFilter ? all.find((r) => r.id === parentFilter) : null;
  const publishedCount = all.filter((r) => r.isPublished).length;
  const n = (k: Scope) => (k === 'tumu' ? all.length : k === 'genel' ? all.filter((r) => !r.clientId).length : k === 'yayinda' ? publishedCount : all.filter((r) => r.clientId).length);

  return (
    <View style={{ gap: space.md }}>
      <T muted>Fotoğraflı tarif kütüphaneniz. Planlara ek sayfa olarak eklenir; seçtikleriniz web sitesinde yayınlanır, kişiye özel varyasyonlar yalnızca o danışanda kalır.</T>
      {publishedCount > 0 ? (
        <Button title={`Sitede gör (${publishedCount})`} icon="external-link" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void Linking.openURL(`${SITE_URL}/tarifler`)} />
      ) : null}
      {!clientFilter && !parentFilter ? <HomeFeaturedBox library={all} editable={editable} /> : null}
      <Segmented<Scope>
        value={scope}
        onChange={(v) => setParam('kapsam', v === 'tumu' ? null : v)}
        options={[
          { value: 'tumu', label: `Tümü ${n('tumu')}` },
          { value: 'genel', label: `Genel ${n('genel')}` },
          { value: 'yayinda', label: `Yayında ${n('yayinda')}` },
          { value: 'kisiye-ozel', label: `Özel ${n('kisiye-ozel')}` },
        ]}
      />
      {clientFilter || parentFilter ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {clientFilter ? <FilterPill label={`Danışan: ${filterClient ? `${filterClient.firstName} ${filterClient.lastName}` : 'seçili'}`} onClear={() => setParam('danisan', null)} /> : null}
          {parentFilter ? <FilterPill label={`“${filterParent?.title ?? 'Tarif'}” ve varyasyonları`} onClear={() => setParam('ana', null)} /> : null}
        </View>
      ) : null}
      <SelectField<string>
        label="Kategori"
        value={category}
        options={(['', ...RECIPE_CATEGORIES] as const).map((c) => ({ value: c, label: `${c ? RECIPE_CATEGORY_LABEL[c] : 'Tümü'} (${counts[c] ?? 0})` }))}
        onChange={(v) => setParam('kategori', v || null)}
      />
      <TextField value={q} onChange={setQ} placeholder="Tarif, malzeme veya danışan ara" icon="search" autoCorrect={false} accessibilityLabel="Tarif ara" clearButtonMode="while-editing" />
      {!items.length ? (
        <Empty
          icon="coffee"
          title={all.length ? 'Bu süzgeçle eşleşen tarif yok' : 'Henüz tarif yok'}
          text={
            all.length
              ? scope === 'kisiye-ozel'
                ? 'Bir tarifi açıp “Varyasyon oluştur” ile danışana özel bir versiyon hazırlayabilirsiniz.'
                : 'Kategoriyi, sekmeyi veya aramayı değiştirin.'
              : 'Danışanlarınıza önerdiğiniz tarifleri fotoğrafıyla ekleyin; planlara tek dokunuşla ek sayfa olarak koyun.'
          }
        />
      ) : (
        <Grid>
          {items.map((r) => (
            <RecipeCard key={r.id} recipe={r} onPress={() => router.push(`/panel/tarifler/${r.id}`)} />
          ))}
        </Grid>
      )}
      {filterClient && clientFilter ? (
        <Button title={`${filterClient.firstName} ${filterClient.lastName} profiline git`} icon="user" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/panel/danisanlar/${clientFilter}`)} />
      ) : null}
    </View>
  );
}

export default function RecipesScreen() {
  const { can } = useStaff();
  const params = useLocalSearchParams<{ kategori?: string }>();
  const allowed = can('clinical:read');
  const editable = can('clinical:write');
  const q = useRecipeLibrary(allowed);
  const [open, setOpen] = useState(false);
  const defaultCategory = (RECIPE_CATEGORIES as readonly string[]).includes(params.kategori ?? '') ? (params.kategori as RecipeCategory) : undefined;

  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tarifler' }} />
        <Empty icon="lock" title="Erişim yok" text="Tarifleri görmek için klinik kayıt okuma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Tarifler' }} />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} contentStyle={editable ? { paddingBottom: 110 } : undefined}>
        <QueryView query={q}>{(d) => <Library all={d.items} />}</QueryView>
      </Screen>
      {editable ? <Fab label="Yeni tarif" onPress={() => setOpen(true)} /> : null}
      {editable ? (
        <RecipeFormSheet open={open} onClose={() => setOpen(false)} defaultCategory={defaultCategory} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cocoa, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
});
