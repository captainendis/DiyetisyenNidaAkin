// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışana mesajlar — danışan hesabında ("Hesabım → Mesajlar") GÖRÜNÜR.
 * Görüşme notlarından (NotesTab, yalnızca personel) bilinçli olarak ayrıdır. İçerik şifreli saklanır.
 */
import { useState } from 'react';
import { Eye, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, IconButton, Select, SkeletonRows, Textarea, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import type { StaffClientMessage } from '@shared/portal';

type Appt = { id: string; startsAt: string | null; status: string };

export function ClientMessagesTab({ clientId }: { clientId: string }) {
  const { can } = usePanelAuth();
  const writable = can('clinical:write');
  const { data, error, loading, reload, setData } = useApi(() => api.get<{ items: StaffClientMessage[] }>(`/clients/${clientId}/messages`), [clientId]);
  const appts = useApi(() => api.get<{ items: Appt[] }>(`/clients/${clientId}/appointments`), [clientId]);
  const [draft, setDraft] = useState('');
  const [apptId, setApptId] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: string; appointmentId: string } | null>(null);
  const [pending, setPending] = useState(false);
  const { success, error: toastError, confirm } = useFeedback();

  const apptOptions = [
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
      setData((d) => ({ items: [res.message, ...(d?.items ?? [])] }));
      setDraft('');
      setApptId('');
      success('Mesaj danışanın hesabına eklendi');
    } catch (e) {
      toastError('Mesaj kaydedilemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setPending(true);
    try {
      const res = await api.patch<{ message: StaffClientMessage }>(`/clients/${clientId}/messages/${editing.id}`, { content: editing.content, appointmentId: editing.appointmentId || null });
      setData((d) => ({ items: (d?.items ?? []).map((m) => (m.id === res.message.id ? res.message : m)) }));
      setEditing(null);
      success('Mesaj güncellendi');
    } catch (e) {
      toastError('Mesaj güncellenemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(m: StaffClientMessage) {
    const ok = await confirm({ title: 'Mesaj silinsin mi?', description: 'Danışanın hesabından da kaldırılır.', confirmLabel: 'Mesajı sil', tone: 'danger' });
    if (!ok) return;
    try {
      await api.del(`/clients/${clientId}/messages/${m.id}`);
      setData((d) => ({ items: (d?.items ?? []).filter((x) => x.id !== m.id) }));
      success('Mesaj silindi');
    } catch (e) {
      toastError('Mesaj silinemedi', (e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        {writable && (
          <Card className="p-5">
            <Textarea
              label="Danışana mesaj"
              rows={4}
              placeholder="Örn. Bu hafta akşam öğününde ekmeği 1 dilime indirelim; su takibine devam."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={5000}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Select label="Görüşme" value={apptId} onChange={(e) => setApptId(e.target.value)} options={apptOptions} wrapperClassName="sm:w-72" />
              <Button onClick={() => void add()} loading={pending} disabled={!draft.trim()}>Danışana gönder</Button>
            </div>
          </Card>
        )}
        {loading ? (
          <Card><SkeletonRows rows={3} /></Card>
        ) : error ? (
          <Card><ErrorState message={error.message} onRetry={reload} /></Card>
        ) : !data?.items.length ? (
          <Card><EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="Henüz mesaj yok." description="Görüşme sonrası danışana bırakmak istediğiniz öneriler burada yazılır ve danışanın hesabında görünür." /></Card>
        ) : (
          <ol className="space-y-3">
            {data.items.map((m) => (
              <li key={m.id}>
                <Card as="article" className="p-5">
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-[0.78rem] text-panel-muted">
                      <time className="tabular font-semibold text-cocoa" dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
                      {m.appointmentAt && <span> · {formatDate(m.appointmentAt)} görüşmesi</span>}
                      {m.author && <span> · {m.author.firstName} {m.author.lastName}</span>}
                      {m.updatedAt !== m.createdAt && <span> · düzenlendi</span>}
                    </div>
                    {writable && editing?.id !== m.id && (
                      <div className="-mt-1.5 -mr-2 flex">
                        <IconButton label="Mesajı düzenle" onClick={() => setEditing({ id: m.id, content: m.content, appointmentId: m.appointmentId ?? '' })}><Pencil className="h-4 w-4" /></IconButton>
                        <IconButton label="Mesajı sil" onClick={() => void remove(m)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    )}
                  </header>
                  {editing?.id === m.id ? (
                    <>
                      <Textarea aria-label="Mesajı düzenle" rows={5} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <Select label="Görüşme" value={editing.appointmentId} onChange={(e) => setEditing({ ...editing, appointmentId: e.target.value })} options={apptOptions} wrapperClassName="sm:w-72" />
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Vazgeç</Button>
                          <Button size="sm" loading={pending} onClick={() => void saveEdit()}>Kaydet</Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-espresso">{m.content}</p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>
      <aside className="h-fit rounded-xl border border-panel-line bg-white/60 p-5 text-[0.8rem] leading-relaxed text-panel-muted">
        <p className="mb-1.5 flex items-center gap-2 font-semibold text-cocoa"><Eye className="h-4 w-4" /> Danışan görür</p>
        Buraya yazdıklarınız danışanın hesabında “Mesajlar” bölümünde görünür. Yalnızca size ait klinik değerlendirmeler için “Görüşme Notları” sekmesini kullanın; onlar danışana gösterilmez.
      </aside>
    </div>
  );
}
