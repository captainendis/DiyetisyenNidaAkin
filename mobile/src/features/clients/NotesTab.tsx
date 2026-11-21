// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Görüşme notları — yalnızca clinical:read; içerik sunucuda şifreli saklanır */
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Icon, IconButton, Notice, QueryView, T, TextField, confirm, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { TextEntrySheet } from './TextEntrySheet';
import { clientKeys, type ConsultationNote } from './types';

type Res = { items: ConsultationNote[] };

export function NotesTab({ clientId }: { clientId: string }) {
  const { can } = useStaff();
  const writable = can('clinical:write');
  const key = clientKeys.sub(clientId, 'notes');
  const q = useApiQuery(key, () => api.get<Res>(`/clients/${clientId}/notes`));
  const setItems = (fn: (items: ConsultationNote[]) => ConsultationNote[]) => queryClient.setQueryData<Res>(key, (d) => ({ items: fn(d?.items ?? []) }));
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<ConsultationNote | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function add() {
    if (!draft.trim()) return;
    setPending(true);
    try {
      const res = await api.post<{ note: ConsultationNote }>(`/clients/${clientId}/notes`, { content: draft });
      setItems((items) => [res.note, ...items]);
      setDraft('');
      toast('Not kaydedildi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(content: string) {
    if (!editing) return;
    setPending(true);
    try {
      const res = await api.patch<{ note: ConsultationNote }>(`/clients/${clientId}/notes/${editing.id}`, { content });
      setItems((items) => items.map((n) => (n.id === res.note.id ? res.note : n)));
      setEditing(null);
      toast('Not güncellendi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  async function remove(n: ConsultationNote) {
    if (!(await confirm({ title: 'Not silinsin mi?', message: 'Bu işlem geri alınamaz.', confirmText: 'Notu sil', destructive: true }))) return;
    try {
      await api.del(`/clients/${clientId}/notes/${n.id}`);
      setItems((items) => items.filter((x) => x.id !== n.id));
      toast('Not silindi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <View style={{ gap: space.md }}>
      {writable ? (
        <Card style={{ gap: space.md }}>
          <TextField
            label="Yeni görüşme notu"
            rows={4}
            placeholder="Görüşmede konuşulanlar, hedefler, bir sonraki adımlar…"
            value={draft}
            onChange={setDraft}
            maxLength={10000}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock" size={13} color={colors.muted} />
              <T variant="caption">Şifreli saklanır</T>
            </View>
            <Button title="Notu kaydet" loading={pending && !editing} disabled={!draft.trim()} onPress={() => void add()} />
          </View>
        </Card>
      ) : null}
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Card>
              <Empty icon="edit-3" title="Henüz görüşme notu yok." text="Görüşme sonrasında notlarınızı buraya ekleyebilirsiniz." />
            </Card>
          ) : (
            <View style={{ gap: space.md }}>
              {data.items.map((n) => (
                <Card key={n.id} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <T variant="caption" style={{ flex: 1 }}>
                      <T variant="caption" weight="semibold" color={colors.text}>{formatDateTime(n.createdAt)}</T>
                      {n.author ? ` · ${n.author.firstName} ${n.author.lastName}` : ''}
                      {n.updatedAt !== n.createdAt ? ` · düzenlendi ${formatDateTime(n.updatedAt)}` : ''}
                    </T>
                    {writable ? (
                      <View style={{ flexDirection: 'row', marginTop: -6, marginRight: -6 }}>
                        <IconButton name="edit-2" label="Notu düzenle" onPress={() => setEditing(n)} color={colors.muted} />
                        <IconButton name="trash-2" label="Notu sil" onPress={() => void remove(n)} color={colors.dangerInk} />
                      </View>
                    ) : null}
                  </View>
                  <T selectable>{n.content}</T>
                </Card>
              ))}
            </View>
          )
        }
      </QueryView>
      <Notice
        tone="neutral"
        icon="lock"
        title="Gizlilik"
        text="Görüşme notları veritabanında AES-256 ile şifrelenir ve yalnızca klinik yetkisi olan kullanıcılar tarafından görüntülenebilir; danışan hesabında gösterilmez. Danışanın görmesini istediğiniz öneriler için “Danışana Mesajlar” sekmesini kullanın."
      />
      <TextEntrySheet
        visible={!!editing}
        title="Notu düzenle"
        initial={editing?.content ?? ''}
        pending={pending}
        maxLength={10000}
        onClose={() => setEditing(null)}
        onSave={(content) => void saveEdit(content)}
      />
    </View>
  );
}
