/** Sık sorulan sorular: satır içi düzenleme, yayın durumu, sıralama */
import { useState } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, IconButton, Modal, SkeletonRows, Switch, Textarea, useFeedback } from '@/components/panel/ui';

interface Faq { id: string; question: string; answer: string; isPublished: boolean; sortOrder: number }

export function FaqManager() {
  const fb = useFeedback();
  const list = useApi(() => api.get<{ items: Faq[] }>('/content/faqs'), []);
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const items = list.data?.items ?? [];

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    try {
      const body = { question: editing.question ?? '', answer: editing.answer ?? '', isPublished: editing.isPublished ?? false };
      if (editing.id) await api.patch(`/content/faqs/${editing.id}`, body);
      else await api.post('/content/faqs', body);
      fb.success(editing.id ? 'Soru güncellendi' : 'Soru eklendi');
      setEditing(null);
      void list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (f: Faq) => {
    list.setData({ items: items.map((x) => (x.id === f.id ? { ...x, isPublished: !f.isPublished } : x)) });
    try {
      await api.patch(`/content/faqs/${f.id}`, { isPublished: !f.isPublished });
      fb.success(f.isPublished ? 'Soru yayından kaldırıldı' : 'Soru yayınlandı');
    } catch {
      fb.error('Güncellenemedi');
      void list.reload();
    }
  };

  const move = async (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    list.setData({ items: next });
    try {
      await api.post('/content/faqs/reorder', { ids: next.map((f) => f.id) });
    } catch {
      fb.error('Sıralama kaydedilemedi');
      void list.reload();
    }
  };

  const remove = async (f: Faq) => {
    if (!(await fb.confirm({ title: 'Soruyu sil', description: `“${f.question}” kalıcı olarak silinecek.`, confirmLabel: 'Sil', tone: 'danger' }))) return;
    try {
      await api.del(`/content/faqs/${f.id}`);
      fb.success('Soru silindi');
      void list.reload();
    } catch {
      fb.error('Silinemedi');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Sık sorulan sorular"
        description="Yayındaki sorular web sitesinde gösterilir. Taslak sorular yalnızca burada görünür."
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => (setErrors({}), setEditing({ isPublished: false }))}>Soru ekle</Button>}
        className="pb-4"
      />
      {list.loading && !list.data ? (
        <SkeletonRows rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !items.length ? (
        <EmptyState icon={<HelpCircle className="h-5 w-5" />} title="Henüz soru yok" description="Danışanların sıkça sorduğu soruları ekleyerek randevu öncesi merak edilenleri yanıtlayın." />
      ) : (
        <ul className="divide-y divide-panel-line border-t border-panel-line">
          {items.map((f, i) => (
            <li key={f.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-espresso">{f.question}</p>
                  {f.isPublished ? <Badge tone="success">Yayında</Badge> : <Badge>Taslak</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-panel-muted">{f.answer}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="mr-2"><Switch checked={f.isPublished} onChange={() => void togglePublish(f)} label={<span className="sr-only">Yayında</span>} /></div>
                <IconButton label="Yukarı taşı" disabled={i === 0} onClick={() => void move(i, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                <IconButton label="Aşağı taşı" disabled={i === items.length - 1} onClick={() => void move(i, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                <IconButton label="Düzenle" onClick={() => (setErrors({}), setEditing(f))}><Pencil className="h-4 w-4" /></IconButton>
                <IconButton label="Sil" className="hover:text-danger" onClick={() => void remove(f)}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Soruyu düzenle' : 'Yeni soru'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Vazgeç</Button>
            <Button onClick={() => void save()} loading={saving}>Kaydet</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Textarea label="Soru" rows={2} required maxLength={300} value={editing.question ?? ''} error={errors.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            <Textarea label="Yanıt" rows={6} required maxLength={3000} value={editing.answer ?? ''} error={errors.answer} hint="Tıbbi tavsiye niteliği taşıyan yanıtlarda genel bilgilendirme diliyle yazın." onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            <Switch checked={!!editing.isPublished} onChange={(v) => setEditing({ ...editing, isPublished: v })} label="Web sitesinde yayınla" />
          </div>
        )}
      </Modal>
    </Card>
  );
}
