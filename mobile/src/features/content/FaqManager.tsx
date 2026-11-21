// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Sık sorulan sorular: ekleme/düzenleme, yayın durumu, sıralama, silme (web: FaqManager.tsx) */
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Badge, Button, Card, confirm, Empty, Fab, IconButton, moveItem, QueryView, Sortable, Screen, Sheet, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';

interface Faq {
  id: string;
  question: string;
  answer: string;
  isPublished: boolean;
  sortOrder: number;
}
type ListRes = { items: Faq[] };
const QK = ['content', 'faqs'] as const;

export function FaqManager() {
  const toast = useToast();
  const list = useApiQuery(QK, () => api.get<ListRes>('/content/faqs'));
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setItems = (items: Faq[]) => queryClient.setQueryData<ListRes>(QK, { items });
  const reload = () => void list.refetch();

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    try {
      const body = { question: editing.question ?? '', answer: editing.answer ?? '', isPublished: editing.isPublished ?? false };
      if (editing.id) await api.patch(`/content/faqs/${editing.id}`, body);
      else await api.post('/content/faqs', body);
      toast(editing.id ? 'Soru güncellendi' : 'Soru eklendi');
      setEditing(null);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (items: Faq[], f: Faq) => {
    setItems(items.map((x) => (x.id === f.id ? { ...x, isPublished: !f.isPublished } : x)));
    try {
      await api.patch(`/content/faqs/${f.id}`, { isPublished: !f.isPublished });
      toast(f.isPublished ? 'Soru yayından kaldırıldı' : 'Soru yayınlandı');
    } catch {
      toast('Güncellenemedi', 'error');
      reload();
    }
  };

  const move = async (items: Faq[], from: number, to: number) => {
    const next = moveItem(items, from, to);
    setItems(next);
    try {
      await api.post('/content/faqs/reorder', { ids: next.map((f) => f.id) });
    } catch {
      toast('Sıralama kaydedilemedi', 'error');
      reload();
    }
  };

  const remove = async (f: Faq) => {
    if (!(await confirm({ title: 'Soruyu sil', message: `“${f.question}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true }))) return;
    try {
      await api.del(`/content/faqs/${f.id}`);
      toast('Soru silindi');
      reload();
    } catch {
      toast('Silinemedi', 'error');
    }
  };

  const openNew = () => {
    setErrors({});
    setEditing({ isPublished: false });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={list.refreshing} onRefresh={list.refresh} contentStyle={{ paddingBottom: 100 }}>
        <T variant="caption" style={{ marginBottom: space.lg }}>Yayındaki sorular web sitesinde gösterilir. Taslak sorular yalnızca burada görünür.</T>
        <QueryView query={list}>
          {({ items }) =>
            !items.length ? (
              <Empty icon="help-circle" title="Henüz soru yok" text="Danışanların sıkça sorduğu soruları ekleyerek randevu öncesi merak edilenleri yanıtlayın." action={<Button title="Soru ekle" icon="plus" onPress={openNew} />} />
            ) : (
              <Sortable
                items={items}
                keyOf={(f) => f.id}
                gap={space.md}
                labelOf={(f) => f.question}
                onReorder={(from, to) => void move(items, from, to)}
                renderItem={(f, _i, handle) => (
                  <Card padded={false}>
                    <View style={{ padding: space.lg, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                        <T variant="subheading" style={{ flex: 1 }}>{f.question}</T>
                        {f.isPublished ? <Badge label="Yayında" tone="success" /> : <Badge label="Taslak" />}
                      </View>
                      <T variant="caption" numberOfLines={3}>{f.answer}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
                      {handle}
                      <Switch
                        value={f.isPublished}
                        onValueChange={() => void togglePublish(items, f)}
                        accessibilityLabel={`${f.question}: yayında`}
                        trackColor={{ true: colors.gold, false: colors.line }}
                      />
                      <T variant="caption" style={{ flex: 1, marginLeft: 4 }}>Yayında</T>
                      <IconButton name="edit-2" label="Düzenle" onPress={() => (setErrors({}), setEditing(f))} />
                      <IconButton name="trash-2" label="Sil" color={colors.dangerInk} onPress={() => void remove(f)} />
                    </View>
                  </Card>
                )}
              />
            )
          }
        </QueryView>
      </Screen>
      {list.data?.items.length ? <Fab label="Soru ekle" onPress={openNew} /> : null}
      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Soruyu düzenle' : 'Yeni soru'}
        full
        footer={
          <>
            <Button title="Vazgeç" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(null)} />
            <Button title="Kaydet" style={{ flex: 1 }} loading={saving} onPress={() => void save()} />
          </>
        }
      >
        {editing ? (
          <>
            <TextField label="Soru" required rows={2} maxLength={300} value={editing.question ?? ''} error={errors.question} onChange={(v) => setEditing({ ...editing, question: v })} />
            <TextField
              label="Yanıt"
              required
              rows={8}
              maxLength={3000}
              value={editing.answer ?? ''}
              error={errors.answer}
              help="Tıbbi tavsiye niteliği taşıyan yanıtlarda genel bilgilendirme diliyle yazın."
              onChange={(v) => setEditing({ ...editing, answer: v })}
            />
            <SwitchField label="Web sitesinde yayınla" value={!!editing.isPublished} onChange={(v) => setEditing({ ...editing, isPublished: v })} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
