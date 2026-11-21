// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planı düzenleyici + önizleme + PDF (web: /panel/planlar/:id — PlanEditorPage) */
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, confirm, Empty, IconButton, ListItem, Notice, QueryView, Screen, Segmented, Sheet, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { queryClient, useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import type { NutritionPlanData } from '@shared/plan';
import { clone, sharePlanPdf, tidyPlan, type PlanDetail } from '@/features/plans/api';
import { PlanEditorForm } from '@/features/plans/PlanEditorForm';
import { PlanPreview } from '@/features/plans/PlanPreview';
import { A4Preview, fitMessage, printRecipesFor } from '@/features/plans/A4Preview';
import type { FitResult } from '@shared/plan-template';
import { useRecipeLibrary } from '@/features/recipes/api';

function Editor({ plan }: { plan: PlanDetail }) {
  const { can } = useStaff();
  const editable = can('clinical:write');
  const toast = useToast();
  const [data, setData] = useState<NutritionPlanData>(() => clone(plan.data));
  const [saved, setSaved] = useState<{ name: string; data: NutritionPlanData }>(() => ({ name: plan.name, data: clone(plan.data) }));
  const [name, setName] = useState(plan.name);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [view, setView] = useState<'form' | 'a4' | 'preview'>(editable ? 'form' : 'a4');
  const [fit, setFit] = useState<FitResult | null>(null);
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const library = useRecipeLibrary();
  const printRecipes = useMemo(() => printRecipesFor(data, library.data?.items), [data, library.data]);

  const dirty = JSON.stringify(data) !== JSON.stringify(saved.data) || name !== saved.name;
  const set = useCallback((fn: (d: NutritionPlanData) => void) => setData((d) => { const n = clone(d); fn(n); return n; }), []);

  const save = async (silent = false) => {
    setSaving(true);
    try {
      const clean = tidyPlan(data);
      const finalName = name.trim() || saved.name;
      await api.patch(`/plans/${plan.id}`, { name: finalName, data: clean });
      setData(clone(clean));
      setName(finalName);
      setSaved({ name: finalName, data: clone(clean) });
      queryClient.setQueryData(['plans', plan.id], { plan: { ...plan, name: finalName, data: clean } });
      void queryClient.invalidateQueries({ queryKey: ['plans'], predicate: (q) => q.queryKey[1] !== plan.id });
      if (!silent) toast('Plan kaydedildi');
      return true;
    } catch (e) {
      const first = e instanceof ApiError ? Object.values(e.fields)[0] : undefined;
      toast(`Kaydedilemedi: ${first ?? errorMessage(e)}`, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  usePreventRemove(dirty && editable && !leaving, ({ repeat }) => {
    Alert.alert('Kaydedilmemiş değişiklikler var', 'Çıkmadan önce kaydetmek ister misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Kaydetmeden çık', style: 'destructive', onPress: () => { setLeaving(true); setTimeout(repeat, 0); } },
      { text: 'Kaydet', onPress: async () => { if (await save(true)) { setLeaving(true); setTimeout(repeat, 0); } } },
    ]);
  });

  const pdf = async () => {
    setPrinting(true);
    try {
      if (dirty && editable && !(await save(true))) return;
      await sharePlanPdf(plan.id, name.trim() || plan.name);
    } catch (e) {
      toast(`PDF hazırlanamadı: ${errorMessage(e)}`, 'error');
    } finally {
      setPrinting(false);
    }
  };

  const saveAsTemplate = async () => {
    setMenu(false);
    try {
      await api.post('/plans', { isTemplate: true, name: `${name} (şablon)`.slice(0, 80), data: { ...tidyPlan(data), title: 'Beslenme planı' } });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast('Şablon olarak kaydedildi. Şablonlar sekmesinde bulabilirsiniz.');
    } catch (e) {
      toast(`Şablon kaydedilemedi: ${errorMessage(e)}`, 'error');
    }
  };

  const remove = async () => {
    setMenu(false);
    if (!(await confirm({ title: 'Plan silinsin mi?', message: 'Bu işlem geri alınamaz.', confirmText: 'Sil', destructive: true }))) return;
    try {
      await api.del(`/plans/${plan.id}`);
      queryClient.removeQueries({ queryKey: ['plans', plan.id] });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast('Plan silindi');
      setLeaving(true);
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/panel/planlar')), 0);
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
    }
  };

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {editable ? <Button title="Kaydet" icon="save" variant="secondary" loading={saving} disabled={!dirty} style={{ flex: 1 }} onPress={() => void save()} /> : null}
          <Button title="PDF / Paylaş" icon="printer" loading={printing} style={{ flex: 1 }} onPress={() => void pdf()} />
        </View>
      }
    >
      <Stack.Screen
        options={{
          title: plan.isTemplate ? 'Şablon' : 'Beslenme planı',
          headerRight: editable ? () => <IconButton name="more-horizontal" label="Diğer işlemler" onPress={() => setMenu(true)} /> : undefined,
        }}
      />
      <View style={{ gap: space.md, marginBottom: space.lg }}>
        <TextField label="Plan adı" value={name} onChange={setName} maxLength={80} editable={editable} help="Yalnızca panelde listeleme için kullanılır." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {plan.isTemplate ? <Badge label="Şablon" tone="gold" /> : null}
          {dirty ? <Badge label="Kaydedilmedi" tone="warning" /> : null}
          {!editable ? <Badge label="Yalnızca görüntüleme" /> : null}
        </View>
        {plan.client ? (
          <Card padded={false}>
            <ListItem icon="user" title={`${plan.client.firstName} ${plan.client.lastName}`} subtitle="Danışan profili" onPress={() => router.push(`/panel/danisanlar/${plan.client!.id}`)} last />
          </Card>
        ) : null}
        <Segmented<'form' | 'a4' | 'preview'> value={view} onChange={setView} options={[{ value: 'form', label: 'Düzenle' }, { value: 'a4', label: 'A4 önizleme' }, { value: 'preview', label: 'Telefonda' }]} />
      </View>
      {view === 'form' ? (
        <PlanEditorForm data={data} set={set} library={library.data?.items} client={plan.client} editable={editable} />
      ) : view === 'a4' ? (
        <View style={{ gap: space.sm }}>
          <A4Preview data={data} recipes={printRecipes} onFit={setFit} />
          {(() => {
            const m = fitMessage(fit);
            return m.tone === 'neutral' ? <T variant="caption">{m.text}</T> : <Notice tone={m.tone} text={m.text} />;
          })()}
          {fit && fit.pages > 1 ? (
            fit.recipesFit ? (
              <T variant="caption">{`Tarif önerileri ${fit.pages - 1} ek sayfaya yerleşti · toplam ${fit.pages} sayfa.`}</T>
            ) : (
              <Notice tone="warning" text="Bir tarif tek sayfaya sığmıyor. Adımlarını veya malzeme listesini kısaltın." />
            )
          ) : null}
          <T variant="caption">PDF bu önizlemeyle aynıdır; “PDF / Paylaş” ile kaydedebilir ya da yazdırabilirsiniz.</T>
        </View>
      ) : (
        <PlanPreview data={data} library={library.data?.items} />
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Plan işlemleri">
        <Card padded={false}>
          <ListItem icon="printer" title="PDF / Paylaş" subtitle="Kaydedilmemiş değişiklikler önce kaydedilir." onPress={() => { setMenu(false); void pdf(); }} />
          {!plan.isTemplate ? <ListItem icon="bookmark" title="Şablon olarak kaydet" subtitle="Planın bir kopyası şablonlara eklenir." onPress={() => void saveAsTemplate()} /> : null}
          <ListItem icon="trash-2" title="Planı sil" danger last onPress={() => void remove()} />
        </Card>
      </Sheet>
    </Screen>
  );
}

export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useStaff();
  const allowed = can('clinical:read');
  const q = useApiQuery(['plans', id], () => api.get<{ plan: PlanDetail }>(`/plans/${id}`), { enabled: allowed && !!id, staleTime: Infinity });
  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Beslenme planı' }} />
        <Empty icon="lock" title="Erişim yok" text="Beslenme planlarını görmek için klinik kayıt okuma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Beslenme planı' }} />
      <QueryView query={q}>{(d) => <Editor key={d.plan.id} plan={d.plan} />}</QueryView>
    </>
  );
}
