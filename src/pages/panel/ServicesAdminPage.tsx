/** Hizmet yönetimi — sıralama (sürükle-bırak + klavye), yayın durumu, düzenleme */
import { useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Leaf, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, SkeletonRows, Switch, useFeedback } from '@/components/panel/ui';
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { Notice } from '@/components/panel/content/FormBits';
import { ServiceFormModal } from '@/components/panel/services/ServiceFormModal';
import type { Service } from '@/components/panel/services/types';
import { cn, formatMoney } from '@/lib/format';

export default function ServicesAdminPage() {
  const fb = useFeedback();
  const list = useApi(() => api.get<{ items: Service[] }>('/services'), []);
  const [editing, setEditing] = useState<{ service: Service | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const untouched = items.some((s) => s.createdAt === s.updatedAt);

  const persistOrder = async (next: Service[]) => {
    list.setData({ items: next });
    try {
      await api.post('/services/reorder', { ids: next.map((s) => s.id) });
    } catch {
      fb.error('Sıralama kaydedilemedi');
      void list.reload();
    }
  };

  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    void persistOrder(next);
  };

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const next = [...items];
    const from = next.findIndex((s) => s.id === dragId);
    const to = next.findIndex((s) => s.id === targetId);
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setDragId(null);
    setOverId(null);
    void persistOrder(next);
  };

  const toggle = async (s: Service) => {
    list.setData({ items: items.map((x) => (x.id === s.id ? { ...x, isPublished: !s.isPublished } : x)) });
    try {
      await api.patch(`/services/${s.id}/visibility`, { isPublished: !s.isPublished });
      fb.success(s.isPublished ? 'Hizmet yayından kaldırıldı' : 'Hizmet yayınlandı');
    } catch {
      fb.error('Güncellenemedi');
      void list.reload();
    }
  };

  const remove = async (s: Service) => {
    const ok = await fb.confirm({
      title: 'Hizmeti sil',
      description: `“${s.title}” kalıcı olarak silinecek. Bu hizmetle oluşturulmuş randevular silinmez; yalnızca hizmet bağlantısı kaldırılır. Geçici olarak gizlemek için yayından kaldırmayı tercih edebilirsiniz.`,
      confirmLabel: 'Sil',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/services/${s.id}`);
      fb.success('Hizmet silindi');
      void list.reload();
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  return (
    <RequirePermission perm="services:write">
      <PageHeader
        eyebrow="Web sitesi"
        title="Hizmetler"
        description="Ana sayfada ve Hizmetler sayfasında görünen hizmetler. Sıralamayı sürükleyerek ya da oklarla değiştirebilirsiniz."
        actions={
          <>
            <a href="/hizmetler" target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-cocoa hover:underline">
              Sitede görüntüle <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ service: null })}>Yeni hizmet</Button>
          </>
        }
      />
      {untouched && (
        <Notice tone="warning" className="mb-5">
          Hizmet metinleri taslaktır; sunulan hizmetleri doğrulayıp düzenleyin. Sunmadığınız hizmetleri yayından kaldırın veya silin.
        </Notice>
      )}
      <Card>
        {list.loading && !list.data ? (
          <SkeletonRows rows={5} />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !items.length ? (
          <EmptyState
            icon={<Leaf className="h-5 w-5" />}
            title="Henüz hizmet yok"
            description="Sunduğunuz danışmanlık hizmetlerini ekleyin; yayındaki hizmetler web sitesinde kart olarak listelenir."
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ service: null })}>Hizmet ekle</Button>}
          />
        ) : (
          <ol className="divide-y divide-panel-line" aria-label="Hizmet sıralaması">
            {items.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={(e) => {
                  setDragId(s.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverId(s.id);
                }}
                onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                onDragEnd={() => (setDragId(null), setOverId(null))}
                onDrop={(e) => onDrop(e, s.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-4 transition-colors sm:gap-4 sm:px-5',
                  dragId === s.id && 'opacity-50',
                  overId === s.id && dragId !== s.id && 'bg-rose/10',
                  !s.isPublished && 'bg-panel-bg/40',
                )}
              >
                <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-panel-muted sm:block" aria-hidden />
                <span className="tabular w-6 shrink-0 font-display text-[1.05rem] text-gold">{String(i + 1).padStart(2, '0')}</span>
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', s.isPublished ? 'bg-espresso text-rose' : 'bg-panel-line/60 text-cocoa/50')}>
                  <ServiceIcon name={s.icon} className="h-7 w-7" />
                </span>
                <button type="button" onClick={() => setEditing({ service: s })} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-semibold', s.isPublished ? 'text-espresso' : 'text-cocoa/60')}>{s.title}</span>
                    {!s.isPublished && <Badge>Yayında değil</Badge>}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-[0.82rem] text-panel-muted">{s.summary}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-[0.75rem] text-panel-muted">
                    {s.durationMinutes && <span>{s.durationMinutes} dk</span>}
                    {s.priceCents != null && <span>{formatMoney(s.priceCents)}{s.showPrice ? '' : ' (gizli)'}</span>}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <div className="mr-1 hidden sm:block">
                    <Switch checked={s.isPublished} onChange={() => void toggle(s)} label={<span className="sr-only">{s.title} yayında</span>} />
                  </div>
                  <IconButton label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                  <IconButton label="Aşağı taşı" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                  <IconButton label="Düzenle" className="hidden sm:inline-flex" onClick={() => setEditing({ service: s })}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label="Sil" className="hover:text-danger" onClick={() => void remove(s)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <ServiceFormModal
        open={!!editing}
        service={editing?.service ?? null}
        index={editing?.service ? items.findIndex((x) => x.id === editing.service!.id) : items.length}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.reload();
        }}
      />
    </RequirePermission>
  );
}
