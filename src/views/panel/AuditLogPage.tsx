// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/** Denetim kayıtları — kim, ne zaman, hangi işlemi yaptı. Hassas içerik (not metni vb.) kaydedilmez. */
import { useState } from 'react';
import { Link } from '@/lib/router';
import { ArrowLeft, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, ResponsiveTable, Select, SkeletonRows } from '@/components/panel/ui';
import { AUDIT_ENTITY_LABEL, auditLabel as label, auditTone } from '@/components/panel/settings/auditLabels';
import { formatDateTime } from '@/lib/format';

interface Row {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export default function AuditLogPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Row | null>(null);
  const facets = useApi(() => api.get<{ actions: string[]; entityTypes: string[] }>('/audit-logs/facets'), []);
  const list = useApi(
    () => api.get<{ items: Row[]; total: number; pageSize: number }>('/audit-logs', { action, entityType, from, to, page, pageSize: 30 }),
    [action, entityType, from, to, page],
  );
  const filtered = !!(action || entityType || from || to);
  const clear = () => {
    setAction('');
    setEntityType('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <RequirePermission perm="audit:read">
      <Link to="/panel/ayarlar?sekme=kvkk" className="mb-2 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-panel-muted hover:text-cocoa">
        <ArrowLeft className="h-4 w-4" /> KVKK & Gizlilik
      </Link>
      <PageHeader
        eyebrow="Ayarlar"
        title="Denetim kayıtları"
        description="Paneldeki kritik işlemlerin kaydı: girişler, veri değişiklikleri, dışa aktarımlar. Not içerikleri ve ölçüm değerleri kayda yazılmaz."
      />
      <Card>
        <div className="grid gap-3 border-b border-panel-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_10rem_10rem_auto] lg:items-end">
          <Select
            label="İşlem"
            value={action}
            onChange={(e) => (setAction(e.target.value), setPage(1))}
            placeholder="Tüm işlemler"
            options={(facets.data?.actions ?? []).map((a) => ({ value: a, label: label(a) }))}
          />
          <Select
            label="Kayıt türü"
            value={entityType}
            onChange={(e) => (setEntityType(e.target.value), setPage(1))}
            placeholder="Tüm türler"
            options={(facets.data?.entityTypes ?? []).map((t) => ({ value: t, label: AUDIT_ENTITY_LABEL[t] ?? t }))}
          />
          <Input label="Başlangıç" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
          <Input label="Bitiş" type="date" value={to} min={from || undefined} onChange={(e) => (setTo(e.target.value), setPage(1))} />
          {filtered && (
            <Button variant="ghost" onClick={clear}>
              Temizle
            </Button>
          )}
        </div>
        {list.loading && !list.data ? (
          <SkeletonRows rows={6} />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={<ScrollText className="h-5 w-5" />}
            title={filtered ? 'Eşleşen kayıt yok' : 'Henüz kayıt yok'}
            description={filtered ? 'Filtreleri değiştirerek tekrar deneyin.' : 'Panelde işlem yapıldıkça burada listelenir.'}
            action={filtered ? <Button variant="secondary" size="sm" onClick={clear}>Filtreleri temizle</Button> : undefined}
          />
        ) : (
          <>
            <ResponsiveTable
              rows={list.data.items}
              rowKey={(r) => r.id}
              onRowClick={setDetail}
              columns={[
                { key: 'time', header: 'Zaman', cell: (r) => <span className="tabular whitespace-nowrap text-cocoa/80">{formatDateTime(r.createdAt)}</span> },
                { key: 'action', header: 'İşlem', cell: (r) => <Badge tone={auditTone(r.action)}>{label(r.action)}</Badge> },
                { key: 'entity', header: 'Kayıt', cell: (r) => <span className="text-cocoa/80">{AUDIT_ENTITY_LABEL[r.entityType] ?? r.entityType}</span> },
                {
                  key: 'user',
                  header: 'Kullanıcı',
                  cell: (r) => (r.user ? <span className="text-espresso">{r.user.firstName} {r.user.lastName}</span> : <span className="text-panel-muted">Sistem / anonim</span>),
                },
                { key: 'ip', header: 'IP', cell: (r) => <span className="tabular text-panel-muted">{r.ip ?? '—'}</span> },
              ]}
              mobileCard={(r) => (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={auditTone(r.action)}>{label(r.action)}</Badge>
                    <span className="tabular text-[0.75rem] text-panel-muted">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-[0.8rem] text-cocoa/80">
                    {AUDIT_ENTITY_LABEL[r.entityType] ?? r.entityType} · {r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Sistem / anonim'}
                  </p>
                </div>
              )}
            />
            <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? label(detail.action) : ''} description={detail ? formatDateTime(detail.createdAt) : undefined}>
        {detail && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr] sm:gap-y-3">
            <dt className="text-panel-muted">İşlem kodu</dt>
            <dd className="mb-2 font-mono text-[0.8rem] break-all sm:mb-0">{detail.action}</dd>
            <dt className="text-panel-muted">Kayıt</dt>
            <dd className="mb-2 sm:mb-0">
              {AUDIT_ENTITY_LABEL[detail.entityType] ?? detail.entityType}
              {detail.entityId && <span className="ml-1 font-mono text-[0.75rem] break-all text-panel-muted">({detail.entityId})</span>}
            </dd>
            <dt className="text-panel-muted">Kullanıcı</dt>
            <dd className="mb-2 sm:mb-0">{detail.user ? `${detail.user.firstName} ${detail.user.lastName} — ${detail.user.email}` : 'Sistem / anonim'}</dd>
            <dt className="text-panel-muted">IP adresi</dt>
            <dd className="tabular mb-2 sm:mb-0">{detail.ip ?? '—'}</dd>
            <dt className="text-panel-muted">Tarayıcı</dt>
            <dd className="mb-2 text-[0.8rem] break-words text-cocoa/80 sm:mb-0">{detail.userAgent ?? '—'}</dd>
            <dt className="text-panel-muted">Ayrıntılar</dt>
            <dd>
              {detail.metadata && Object.keys(detail.metadata).length ? (
                <pre className="overflow-x-auto rounded-lg bg-panel-bg p-3 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap">{JSON.stringify(detail.metadata, null, 2)}</pre>
              ) : (
                <span className="text-panel-muted">—</span>
              )}
            </dd>
          </dl>
        )}
      </Modal>
    </RequirePermission>
  );
}
