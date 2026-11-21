// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Yeni tarif (tam ekran). ?kategori=<KATEGORI>; ?ana=<tarifId> ile o tarifin varyasyonu;
 * ?danisan=<id> ile varyasyon o danışana özel başlar.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Button, Empty, Loading, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from '@shared/recipe';
import type { ClientRef } from '@/features/recipes/api';
import { RecipeFormFields } from '@/features/recipes/RecipeFormFields';
import { recipeFormSubtitle, recipeFormTitle, recipeSaveLabel } from '@/features/recipes/RecipeFormSheet';
import { useRecipeForm } from '@/features/recipes/useRecipeForm';

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ kategori?: string; ana?: string; danisan?: string }>();
  const { can } = useStaff();
  const editable = can('clinical:write');
  const parent = useApiQuery(['recipes', params.ana], () => api.get<{ recipe: Recipe }>(`/recipes/${params.ana}`), { enabled: editable && !!params.ana });
  const client = useApiQuery(['clients', params.danisan], () => api.get<{ client: ClientRef }>(`/clients/${params.danisan}`), { enabled: editable && !!params.danisan });
  const form = useRecipeForm((r) => router.replace(`/panel/tarifler/${r.id}`));
  const ready = (!params.ana || !!parent.data) && (!params.danisan || !!client.data || !!client.error);
  const inited = useRef(false);
  const { reset } = form;

  useEffect(() => {
    if (!ready || inited.current) return;
    inited.current = true;
    const c = client.data?.client;
    reset({
      variantOf: parent.data?.recipe ?? null,
      defaultClient: c ? { id: c.id, firstName: c.firstName, lastName: c.lastName } : null,
      defaultCategory: (RECIPE_CATEGORIES as readonly string[]).includes(params.kategori ?? '') ? (params.kategori as RecipeCategory) : undefined,
    });
  }, [ready, parent.data, client.data, params.kategori, reset]);

  if (!editable) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni tarif' }} />
        <Empty icon="lock" title="Yetki yok" text="Tarif eklemek için klinik kayıt yazma yetkisi gerekir." />
      </Screen>
    );
  }
  if (params.ana && parent.error) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Varyasyon oluştur' }} />
        <Empty icon="alert-circle" title="Ana tarif bulunamadı" text="Tarif silinmiş olabilir." />
      </Screen>
    );
  }
  if (!ready || !inited.current) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni tarif' }} />
        <Loading />
      </Screen>
    );
  }
  return (
    <Screen
      footer={<Button title={recipeSaveLabel(form)} icon="check" full loading={form.pending} onPress={() => void form.save()} />}
    >
      <Stack.Screen options={{ title: recipeFormTitle(form) }} />
      <T variant="caption" style={{ marginBottom: space.lg }}>{recipeFormSubtitle(form)}</T>
      <RecipeFormFields form={form} />
    </Screen>
  );
}
