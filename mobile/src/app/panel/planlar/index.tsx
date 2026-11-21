// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planları ve şablonlar (web: /panel/planlar — PlansPage). ?gorunum=sablonlar */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Badge, Card, confirm, Empty, Fab, IconButton, ListItem, QueryView, Screen, Segmented, Sheet, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { sharePlanPdf, type PlanListItem } from '@/features/plans/api';
import { useDebounced } from '@/features/recipes/api';

type View_ = 'planlar' | 'sablonlar';

export default function PlansScreen() {
  const params = useLocalSearchParams<{ gorunum?: string }>();
  const view: View_ = params.gorunum === 'sablonlar' ? 'sablonlar' : 'planlar';
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const { can } = useStaff();
  const allowed = can('clinical:read');
  const editable = can('clinical:write');
  const toast = useToast();
  const [actionsFor, setActionsFor] = useState<PlanListItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useApiQuery(['plans', 'list', view, dq], () => api.get<{ items: PlanListItem[] }>('/plans', { templates: view === 'sablonlar' ? '1' : '0', q: dq || undefined }), {
    enabled: allowed,
  });

  const pdf = async (p: PlanListItem) => {
    setActionsFor(null);
    setBusy(p.id);
    try {
      await sharePlanPdf(p.id, p.name);
    } catch (e) {
      toast(`PDF hazırlanamadı: ${errorMessage(e)}`, 'error');
    } finally {
      setBusy(null);
    }
  };
  const duplicate = async (p: PlanListItem) => {
    setActionsFor(null);
    try {
      await api.post('/plans', { isTemplate: true, name: `${p.name} (kopya)`.slice(0, 80), fromId: p.id });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast('Şablon kopyalandı');
    } catch (e) {
      toast(`Kopyalanamadı: ${errorMessage(e)}`, 'error');
    }
  };
  const remove = async (p: PlanListItem) => {
    setActionsFor(null);
    if (!(await confirm({ title: 'Plan silinsin mi?', message: `“${p.name}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true }))) return;
    try {
      await api.del(`/plans/${p.id}`);
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast('Plan silindi');
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
    }
  };
  const openNew = () => router.push(view === 'sablonlar' ? '/panel/planlar/yeni?sablon=1' : '/panel/planlar/yeni');

  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Beslenme Planları' }} />
        <Empty icon="lock" title="Erişim yok" text="Beslenme planlarını görmek için klinik kayıt okuma yetkisi gerekir." />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Beslenme Planları' }} />
      <Screen refreshing={list.refreshing} onRefresh={list.refresh} contentStyle={editable ? { paddingBottom: 110 } : undefined}>
        <View style={{ gap: space.md, marginBottom: space.lg }}>
          <T muted>Danışana özel planlar hazırlayın; A4 PDF olarak paylaşın.</T>
          <Segmented<View_>
            value={view}
            onChange={(v) => router.setParams({ gorunum: v === 'planlar' ? undefined : v })}
            options={[{ value: 'planlar', label: 'Danışan planları' }, { value: 'sablonlar', label: 'Şablonlar' }]}
          />
          <TextField
            value={q}
            onChange={setQ}
            placeholder={view === 'sablonlar' ? 'Şablon ara' : 'Danışan veya plan ara'}
            icon="search"
            autoCorrect={false}
            accessibilityLabel="Ara"
            clearButtonMode="while-editing"
          />
        </View>
        <QueryView query={list}>
          {(d) =>
            !d.items.length ? (
              <Empty
                icon="clipboard"
                title={dq ? 'Aramayla eşleşen plan yok' : view === 'sablonlar' ? 'Henüz şablon yok' : 'Henüz danışan planı yok'}
                text={view === 'sablonlar' ? 'Sık kullandığınız listeleri şablon olarak kaydedin.' : 'Danışan profilinden veya buradan yeni plan oluşturabilirsiniz.'}
              />
            ) : (
              <Card padded={false}>
                {d.items.map((p, i) => (
                  <ListItem
                    key={p.id}
                    icon={p.isTemplate ? 'bookmark' : 'file-text'}
                    title={p.name}
                    subtitle={`${p.client ? `${p.client.firstName} ${p.client.lastName} · ` : ''}${formatDateTime(p.updatedAt)}`}
                    right={
                      busy === p.id ? (
                        <ActivityIndicator color={colors.gold} />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {p.isTemplate ? <Badge label="Şablon" tone="gold" /> : null}
                          <IconButton name="more-vertical" label={`${p.name} işlemleri`} color={colors.muted} onPress={() => setActionsFor(p)} />
                        </View>
                      )
                    }
                    onPress={() => router.push(`/panel/planlar/${p.id}`)}
                    last={i === d.items.length - 1}
                  />
                ))}
              </Card>
            )
          }
        </QueryView>
      </Screen>
      {editable ? <Fab label="Yeni plan" onPress={openNew} /> : null}

      <Sheet visible={!!actionsFor} onClose={() => setActionsFor(null)} title={actionsFor?.name ?? ''} subtitle={actionsFor?.client ? `${actionsFor.client.firstName} ${actionsFor.client.lastName}` : actionsFor?.isTemplate ? 'Şablon' : undefined}>
        {actionsFor ? (
          <Card padded={false}>
            <ListItem icon="edit-3" title={editable ? 'Aç ve düzenle' : 'Aç'} onPress={() => { const id = actionsFor.id; setActionsFor(null); router.push(`/panel/planlar/${id}`); }} />
            <ListItem icon="printer" title="PDF / Paylaş" onPress={() => void pdf(actionsFor)} last={!editable && !actionsFor.client} />
            {actionsFor.client ? (
              <ListItem icon="user" title="Danışan profili" onPress={() => { const id = actionsFor.client!.id; setActionsFor(null); router.push(`/panel/danisanlar/${id}`); }} last={!editable} />
            ) : null}
            {actionsFor.isTemplate && editable ? <ListItem icon="copy" title="Şablonu kopyala" onPress={() => void duplicate(actionsFor)} /> : null}
            {editable ? <ListItem icon="trash-2" title="Sil" danger last onPress={() => void remove(actionsFor)} /> : null}
          </Card>
        ) : null}
      </Sheet>
    </View>
  );
}
