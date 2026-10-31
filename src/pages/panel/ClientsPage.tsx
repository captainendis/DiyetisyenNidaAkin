import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { formatDate, formatPhone } from '@/lib/format';
import { CLIENT_STATUS_LABEL, CLIENT_STATUSES, type ClientStatus } from '@shared/constants';
import {
  Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, ResponsiveTable, Select, SkeletonRows,
} from '@/components/panel/ui';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { ClientFormModal } from '@/components/panel/clients/ClientFormModal';
import { CLIENT_STATUS_TONE, type ClientListItem } from '@/components/panel/clients/types';

type Sort = '-createdAt' | 'createdAt' | 'name' | '-lastVisit';
const SORTS: { value: Sort; label: string }[] = [
  { value: '-createdAt', label: 'En yeni kayıt' },
  { value: 'createdAt', label: 'En eski kayıt' },
  { value: 'name', label: 'Ada göre (A–Z)' },
  { value: '-lastVisit', label: 'Son görüşme' },
];

function ClientsInner() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = usePanelAuth();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<'' | ClientStatus>((params.get('durum') as ClientStatus) ?? '');
  const [sort, setSort] = useState<Sort>((params.get('sirala') as Sort) ?? '-createdAt');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const dq = useDebounced(q.trim(), 300);

  useEffect(() => setPage(1), [dq, status, sort]);

  const { data, error, loading, reload } = useApi(
    () => api.get<{ items: ClientListItem[]; total: number; page: number; pageSize: number }>('/clients', { q: dq, status, sort, page, pageSize: 25 }),
    [dq, status, sort, page],
  );

  const filtered = !!dq || !!status;
  const closeCreate = () => {
    setCreating(false);
    if (params.has('new')) {
      params.delete('new');
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <PageHeader
        title="Danışanlar"
        description={data ? `${data.total} kayıt${status ? ` · ${CLIENT_STATUS_LABEL[status]}` : ''}` : 'Danışan kayıtları ve görüşme geçmişi'}
        actions={can('clients:write') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Yeni danışan</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-panel-line p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative flex-1">
            <span className="sr-only">Danışan ara</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ad, soyad, telefon veya e-posta ile ara"
              className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm text-espresso placeholder:text-panel-muted/70 focus:border-cocoa focus:ring-2 focus:ring-cocoa/10 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              aria-label="Durum filtresi"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus | '')}
              placeholder="Aktif ve pasif"
              options={CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_LABEL[s] }))}
              className="sm:w-44"
            />
            <Select aria-label="Sıralama" value={sort} onChange={(e) => setSort(e.target.value as Sort)} options={SORTS} className="sm:w-44" />
          </div>
        </div>

        {loading && !data ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data?.items.length ? (
          filtered ? (
            <EmptyState icon={<Search className="h-5 w-5" />} title="Eşleşen danışan bulunamadı" description="Arama terimini veya durum filtresini değiştirmeyi deneyin." action={<Button variant="secondary" size="sm" onClick={() => { setQ(''); setStatus(''); }}>Filtreleri temizle</Button>} />
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Henüz danışan kaydı bulunmuyor."
              description="Web sitesinden gelen randevu talepleri onaylandığında danışanlar burada listelenir. Dilerseniz şimdi elle de ekleyebilirsiniz."
              action={can('clients:write') && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>İlk danışanı ekle</Button>}
            />
          )
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <ResponsiveTable
              rows={data.items}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/panel/danisanlar/${r.id}`)}
              columns={[
                {
                  key: 'name', header: 'Ad Soyad',
                  cell: (r) => (
                    <span className="flex items-center gap-3">
                      <Avatar name={`${r.firstName} ${r.lastName}`} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-espresso">{r.firstName} {r.lastName}</span>
                        {r.source === 'WEBSITE' && <span className="text-[0.72rem] text-panel-muted">Web sitesinden</span>}
                      </span>
                    </span>
                  ),
                },
                { key: 'phone', header: 'Telefon', cell: (r) => <span className="tabular whitespace-nowrap text-cocoa">{formatPhone(r.phone)}</span> },
                { key: 'email', header: 'E-posta', cell: (r) => <span className="block max-w-[14rem] truncate text-cocoa">{r.email ?? <span className="text-panel-muted">—</span>}</span> },
                { key: 'created', header: 'İlk kayıt', cell: (r) => <span className="tabular whitespace-nowrap text-cocoa">{formatDate(r.createdAt)}</span> },
                {
                  key: 'last', header: 'Son görüşme',
                  cell: (r) => r.lastVisitAt ? <span className="tabular whitespace-nowrap text-cocoa">{formatDate(r.lastVisitAt)}</span> : <span className="text-panel-muted">Henüz yok</span>,
                },
                { key: 'visits', header: 'Toplam görüşme', headerClassName: 'text-right', className: 'text-right', cell: (r) => <span className="tabular font-semibold text-espresso">{r.totalVisits}</span> },
                { key: 'status', header: 'Durum', cell: (r) => <Badge tone={CLIENT_STATUS_TONE[r.status]}>{CLIENT_STATUS_LABEL[r.status]}</Badge> },
              ]}
              mobileCard={(r) => (
                <div className="flex items-start gap-3">
                  <Avatar name={`${r.firstName} ${r.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-espresso">{r.firstName} {r.lastName}</p>
                      <Badge tone={CLIENT_STATUS_TONE[r.status]}>{CLIENT_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <p className="tabular mt-0.5 text-sm text-cocoa">{formatPhone(r.phone)}</p>
                    <p className="mt-1 text-[0.78rem] text-panel-muted">
                      {r.totalVisits} görüşme · Son: {r.lastVisitAt ? formatDate(r.lastVisitAt) : 'henüz yok'}
                    </p>
                  </div>
                </div>
              )}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>

      <ClientFormModal
        open={creating}
        onClose={closeCreate}
        onSaved={(c) => {
          closeCreate();
          navigate(`/panel/danisanlar/${c.id}`);
        }}
      />
    </>
  );
}

export default function ClientsPage() {
  return (
    <RequirePermission perm="clients:read">
      <ClientsInner />
    </RequirePermission>
  );
}
