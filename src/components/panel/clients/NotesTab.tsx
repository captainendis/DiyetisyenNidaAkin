/** Görüşme notları — yalnızca clinical:read; içerik sunucuda şifreli saklanır */
import { useState } from 'react';
import { Lock, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDateTime } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, IconButton, SkeletonRows, Textarea, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import type { ConsultationNote } from './types';

export function NotesTab({ clientId }: { clientId: string }) {
  const { can } = usePanelAuth();
  const { data, error, loading, reload, setData } = useApi(() => api.get<{ items: ConsultationNote[] }>(`/clients/${clientId}/notes`), [clientId]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [pending, setPending] = useState(false);
  const { success, error: toastError, confirm } = useFeedback();
  const writable = can('clinical:write');

  async function add() {
    if (!draft.trim()) return;
    setPending(true);
    try {
      const res = await api.post<{ note: ConsultationNote }>(`/clients/${clientId}/notes`, { content: draft });
      setData((d) => ({ items: [res.note, ...(d?.items ?? [])] }));
      setDraft('');
      success('Not kaydedildi');
    } catch (e) {
      toastError('Not kaydedilemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setPending(true);
    try {
      const res = await api.patch<{ note: ConsultationNote }>(`/clients/${clientId}/notes/${editing.id}`, { content: editing.content });
      setData((d) => ({ items: (d?.items ?? []).map((n) => (n.id === res.note.id ? res.note : n)) }));
      setEditing(null);
      success('Not güncellendi');
    } catch (e) {
      toastError('Not güncellenemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(n: ConsultationNote) {
    const ok = await confirm({ title: 'Not silinsin mi?', description: 'Bu işlem geri alınamaz.', confirmLabel: 'Notu sil', tone: 'danger' });
    if (!ok) return;
    try {
      await api.del(`/clients/${clientId}/notes/${n.id}`);
      setData((d) => ({ items: (d?.items ?? []).filter((x) => x.id !== n.id) }));
      success('Not silindi');
    } catch (e) {
      toastError('Not silinemedi', (e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        {writable && (
          <Card className="p-5">
            <Textarea
              label="Yeni görüşme notu"
              rows={4}
              placeholder="Görüşmede konuşulanlar, hedefler, bir sonraki adımlar…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={10000}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[0.75rem] text-panel-muted"><Lock className="h-3.5 w-3.5" /> Şifreli saklanır</span>
              <Button onClick={() => void add()} loading={pending} disabled={!draft.trim()}>Notu kaydet</Button>
            </div>
          </Card>
        )}
        {loading ? (
          <Card><SkeletonRows rows={3} /></Card>
        ) : error ? (
          <Card><ErrorState message={error.message} onRetry={reload} /></Card>
        ) : !data?.items.length ? (
          <Card><EmptyState icon={<NotebookPen className="h-5 w-5" />} title="Henüz görüşme notu yok." description="Görüşme sonrasında notlarınızı buraya ekleyebilirsiniz." /></Card>
        ) : (
          <ol className="space-y-3">
            {data.items.map((n) => (
              <li key={n.id}>
                <Card as="article" className="p-5">
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-[0.78rem] text-panel-muted">
                      <time className="tabular font-semibold text-cocoa" dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                      {n.author && <span> · {n.author.firstName} {n.author.lastName}</span>}
                      {n.updatedAt !== n.createdAt && <span> · düzenlendi {formatDateTime(n.updatedAt)}</span>}
                    </div>
                    {writable && editing?.id !== n.id && (
                      <div className="-mt-1.5 -mr-2 flex">
                        <IconButton label="Notu düzenle" onClick={() => setEditing({ id: n.id, content: n.content })}><Pencil className="h-4 w-4" /></IconButton>
                        <IconButton label="Notu sil" onClick={() => void remove(n)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    )}
                  </header>
                  {editing?.id === n.id ? (
                    <>
                      <Textarea aria-label="Notu düzenle" rows={5} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Vazgeç</Button>
                        <Button size="sm" loading={pending} onClick={() => void saveEdit()}>Kaydet</Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-espresso">{n.content}</p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>
      <aside className="h-fit rounded-xl border border-panel-line bg-white/60 p-5 text-[0.8rem] leading-relaxed text-panel-muted">
        <p className="mb-1.5 flex items-center gap-2 font-semibold text-cocoa"><Lock className="h-4 w-4" /> Gizlilik</p>
        Görüşme notları veritabanında AES-256 ile şifrelenir ve yalnızca klinik yetkisi olan kullanıcılar tarafından görüntülenebilir. Her görüntüleme denetim kaydına işlenir.
      </aside>
    </div>
  );
}
