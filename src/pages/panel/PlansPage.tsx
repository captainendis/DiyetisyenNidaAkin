// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** /panel/planlar — beslenme planları ve şablonlar */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Copy, Download, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, ResponsiveTable, SkeletonRows, Tabs, useFeedback } from '@/components/panel/ui';
import { formatDateTime } from '@/lib/format';
import { downloadPlanPdf, type PlanListItem } from '@/components/panel/plans/api';
import { NewPlanModal } from '@/components/panel/plans/NewPlanModal';

type View = 'planlar' | 'sablonlar';

function Body() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('gorunum') as View) || 'planlar';
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [open, setOpen] = useState(params.get('new') === '1');
  const [busy, setBusy] = useState<string | null>(null);
  const { can } = usePanelAuth();
  const fb = useFeedback();
  const { data, loading, error, reload } = useApi(
    () => api.get<{ items: PlanListItem[] }>('/plans', { templates: view === 'sablonlar' ? '1' : '0', q: dq || undefined }),
    [view, dq],
  );

  const pdf = async (id: string) => {
    setBusy(id);
    try {
      const r = await downloadPlanPdf(id);
      if (!r.fits) fb.toast({ tone: 'warning', title: 'Plan sayfaya tam sığmadı', description: 'Düzenleyicide bazı satırları kısaltın.' });
    } catch (e) {
      fb.error('PDF oluşturulamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };
  const duplicate = async (p: PlanListItem) => {
    try {
      await api.post('/plans', { isTemplate: true, name: `${p.name} (kopya)`, fromId: p.id });
      fb.success('Şablon kopyalandı');
      reload();
    } catch (e) {
      fb.error('Kopyalanamadı', e instanceof ApiError ? e.message : undefined);
    }
  };
  const remove = async (p: PlanListItem) => {
    if (!(await fb.confirm({ title: 'Plan silinsin mi?', description: `“${p.name}” kalıcı olarak silinecek.`, confirmLabel: 'Sil', tone: 'danger' }))) return;
    try {
      await api.del(`/plans/${p.id}`);
      fb.success('Plan silindi');
      reload();
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  const items = data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Beslenme Planları"
        description="Danışana özel planlar hazırlayın; tek sayfa A4 PDF olarak indirin."
        actions={can('clinical:write') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Yeni plan</Button>}
      />
      <Card>
        <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs<View>
            className="border-0"
            value={view}
            onChange={(v) => setParams({ gorunum: v }, { replace: true })}
            tabs={[{ value: 'planlar', label: 'Danışan planları' }, { value: 'sablonlar', label: 'Şablonlar' }]}
          />
          <label className="relative mb-3 block sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === 'sablonlar' ? 'Şablon ara' : 'Danışan veya plan ara'} aria-label="Ara" className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none" />
          </label>
        </div>
        <div className="border-t border-panel-line">
          {loading && !data ? (
            <SkeletonRows />
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : !items.length ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={dq ? 'Aramayla eşleşen plan yok' : view === 'sablonlar' ? 'Henüz şablon yok' : 'Henüz danışan planı yok'}
              description={view === 'sablonlar' ? 'Sık kullandığınız listeleri şablon olarak kaydedin.' : 'Danışan profilinden veya buradan yeni plan oluşturabilirsiniz.'}
              action={can('clinical:write') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Yeni plan</Button>}
            />
          ) : (
            <ResponsiveTable
              rows={items}
              rowKey={(p) => p.id}
              columns={[
                { key: 'name', header: 'Plan', cell: (p) => <Link to={`/panel/planlar/${p.id}`} className="font-semibold text-espresso hover:underline">{p.name}</Link> },
                ...(view === 'planlar'
                  ? [{ key: 'client', header: 'Danışan', cell: (p: PlanListItem) => (p.client ? <Link to={`/panel/danisanlar/${p.client.id}?sekme=planlar`} className="hover:underline">{p.client.firstName} {p.client.lastName}</Link> : '—') }]
                  : [{ key: 'type', header: 'Tür', cell: () => <Badge tone="accent">Şablon</Badge> }]),
                { key: 'updated', header: 'Son düzenleme', cell: (p) => <span className="tabular text-panel-muted">{formatDateTime(p.updatedAt)}</span> },
                {
                  key: 'actions', header: <span className="sr-only">İşlemler</span>, className: 'text-right',
                  cell: (p) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="secondary" size="sm" loading={busy === p.id} icon={<Download className="h-4 w-4" />} onClick={() => void pdf(p.id)}>PDF</Button>
                      {p.isTemplate && can('clinical:write') && <Button variant="ghost" size="sm" aria-label="Şablonu kopyala" onClick={() => void duplicate(p)}><Copy className="h-4 w-4" /></Button>}
                      {can('clinical:write') && <Button variant="ghost" size="sm" aria-label="Sil" onClick={() => void remove(p)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ),
                },
              ]}
              mobileCard={(p) => (
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/panel/planlar/${p.id}`} className="min-w-0">
                    <p className="truncate text-sm font-semibold text-espresso">{p.name}</p>
                    <p className="truncate text-[0.78rem] text-panel-muted">{p.client ? `${p.client.firstName} ${p.client.lastName} · ` : ''}{formatDateTime(p.updatedAt)}</p>
                  </Link>
                  <Button variant="secondary" size="sm" loading={busy === p.id} icon={<Download className="h-4 w-4" />} onClick={() => void pdf(p.id)}>PDF</Button>
                </div>
              )}
            />
          )}
        </div>
      </Card>
      <NewPlanModal open={open} onClose={() => setOpen(false)} clientId={params.get('clientId')} defaultTemplate={view === 'sablonlar'} />
    </>
  );
}

export default function PlansPage() {
  return (
    <RequirePermission perm="clinical:read">
      <Body />
    </RequirePermission>
  );
}
