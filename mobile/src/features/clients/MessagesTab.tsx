// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışana mesajlar — danışan hesabında ("Hesabım → Mesajlar") GÖRÜNÜR.
 * Görüşme notlarından (yalnızca personel) bilinçli olarak ayrıdır. İçerik şifreli saklanır.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, IconButton, Notice, QueryView, SelectField, T, TextField, confirm, useToast, type Option } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import type { StaffClientMessage } from '@shared/portal';
import { colors, space } from '@/theme';
import { useClientAppointments } from './AppointmentsTab';
import { TextEntrySheet } from './TextEntrySheet';
import { clientKeys } from './types';

type Res = { items: StaffClientMessage[] };

export function MessagesTab({ clientId }: { clientId: string }) {
  const { can } = useStaff();
  const writable = can('clinical:write');
  const key = clientKeys.sub(clientId, 'messages');
  const q = useApiQuery(key, () => api.get<Res>(`/clients/${clientId}/messages`));
  const appts = useClientAppointments(clientId);
  const setItems = (fn: (items: StaffClientMessage[]) => StaffClientMessage[]) => queryClient.setQueryData<Res>(key, (d) => ({ items: fn(d?.items ?? []) }));
  const [draft, setDraft] = useState('');
  const [apptId, setApptId] = useState('');
  const [editing, setEditing] = useState<StaffClientMessage | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const apptOptions: Option<string>[] = [
    { value: '', label: 'Görüşmeye bağlama' },
    ...(appts.data?.items ?? [])
      .filter((a) => a.startsAt && ['COMPLETED', 'CONFIRMED'].includes(a.status))
      .map((a) => ({ value: a.id, label: `${formatDate(a.startsAt!)} ${formatTime(a.startsAt!)} görüşmesi` })),
  ];

  async function add() {
    if (!draft.trim()) return;
    setPending(true);
    try {
      const res = await api.post<{ message: StaffClientMessage }>(`/clients/${clientId}/messages`, { content: draft, appointmentId: apptId || null });
      setItems((items) => [res.message, ...items]);
      setDraft('');
      setApptId('');
      toast('Mesaj danışanın hesabına eklendi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(content: string, appointmentId: string) {
    if (!editing) return;
    setPending(true);
    try {
      const res = await api.patch<{ message: StaffClientMessage }>(`/clients/${clientId}/messages/${editing.id}`, { content, appointmentId: appointmentId || null });
      setItems((items) => items.map((m) => (m.id === res.message.id ? res.message : m)));
      setEditing(null);
      toast('Mesaj güncellendi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  async function remove(m: StaffClientMessage) {
    if (!(await confirm({ title: 'Mesaj silinsin mi?', message: 'Danışanın hesabından da kaldırılır.', confirmText: 'Mesajı sil', destructive: true }))) return;
    try {
      await api.del(`/clients/${clientId}/messages/${m.id}`);
      setItems((items) => items.filter((x) => x.id !== m.id));
      toast('Mesaj silindi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Notice
        tone="info"
        icon="eye"
        title="Danışan görür"
        text="Buraya yazdıklarınız danışanın hesabında “Mesajlar” bölümünde görünür. Yalnızca size ait klinik değerlendirmeler için “Görüşme Notları” sekmesini kullanın; onlar danışana gösterilmez."
      />
      {writable ? (
        <Card style={{ gap: space.md }}>
          <TextField
            label="Danışana mesaj"
            rows={4}
            placeholder="Örn. Bu hafta akşam öğününde ekmeği 1 dilime indirelim; su takibine devam."
            value={draft}
            onChange={setDraft}
            maxLength={5000}
          />
          <SelectField label="Görüşme" value={apptId} options={apptOptions} onChange={setApptId} />
          <Button title="Danışana gönder" icon="send" loading={pending && !editing} disabled={!draft.trim()} onPress={() => void add()} />
        </Card>
      ) : null}
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Card>
              <Empty icon="message-square" title="Henüz mesaj yok." text="Görüşme sonrası danışana bırakmak istediğiniz öneriler burada yazılır ve danışanın hesabında görünür." />
            </Card>
          ) : (
            <View style={{ gap: space.md }}>
              {data.items.map((m) => (
                <Card key={m.id} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <T variant="caption" style={{ flex: 1 }}>
                      <T variant="caption" weight="semibold" color={colors.text}>{formatDateTime(m.createdAt)}</T>
                      {m.appointmentAt ? ` · ${formatDate(m.appointmentAt)} görüşmesi` : ''}
                      {m.author ? ` · ${m.author.firstName} ${m.author.lastName}` : ''}
                      {m.updatedAt !== m.createdAt ? ' · düzenlendi' : ''}
                    </T>
                    {writable ? (
                      <View style={{ flexDirection: 'row', marginTop: -6, marginRight: -6 }}>
                        <IconButton name="edit-2" label="Mesajı düzenle" onPress={() => setEditing(m)} color={colors.muted} />
                        <IconButton name="trash-2" label="Mesajı sil" onPress={() => void remove(m)} color={colors.dangerInk} />
                      </View>
                    ) : null}
                  </View>
                  <T selectable>{m.content}</T>
                </Card>
              ))}
            </View>
          )
        }
      </QueryView>
      <TextEntrySheet
        visible={!!editing}
        title="Mesajı düzenle"
        initial={editing?.content ?? ''}
        initialAppt={editing?.appointmentId ?? ''}
        apptOptions={apptOptions}
        pending={pending}
        maxLength={5000}
        onClose={() => setEditing(null)}
        onSave={(content, appointmentId) => void saveEdit(content, appointmentId)}
      />
    </View>
  );
}
