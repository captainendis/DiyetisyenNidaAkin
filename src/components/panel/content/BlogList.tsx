// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { FileText, Plus, Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Pagination, ResponsiveTable, Select, SkeletonRows, type BadgeTone } from '@/components/panel/ui';
import { POST_STATUS_LABEL, POST_STATUSES, type PostStatus } from '@shared/constants';
import { formatDate } from '@/lib/format';

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: PostStatus;
  expertReviewed: boolean;
  publishedAt: string | null;
  updatedAt: string;
  coverImageUrl: string | null;
  readingMinutes: number | null;
  category: { id: string; name: string; slug: string } | null;
}

export const POST_TONE: Record<PostStatus, BadgeTone> = { DRAFT: 'neutral', PUBLISHED: 'success', UNPUBLISHED: 'warning' };

export function BlogList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const cats = useApi(() => api.get<{ items: { id: string; name: string; _count: { posts: number } }[] }>('/content/categories'), []);
  const posts = useApi(
    () => api.get<{ items: PostRow[]; total: number; pageSize: number }>('/content/posts', { status, categoryId, q: dq, page, pageSize: 15 }),
    [status, categoryId, dq, page],
  );
  const filtered = !!(status || categoryId || dq);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-panel-line p-4 sm:flex-row sm:items-end sm:p-5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" aria-hidden />
          <Input aria-label="Yazılarda ara" placeholder="Başlık veya özette ara" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="pl-9" />
        </div>
        <Select aria-label="Durum" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} placeholder="Tüm durumlar" options={POST_STATUSES.map((s) => ({ value: s, label: POST_STATUS_LABEL[s] }))} wrapperClassName="sm:w-44" />
        <Select aria-label="Kategori" value={categoryId} onChange={(e) => (setCategoryId(e.target.value), setPage(1))} placeholder="Tüm kategoriler" options={(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} wrapperClassName="sm:w-52" />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/panel/icerikler/blog/yeni')}>
          Yeni yazı
        </Button>
      </div>
      {posts.loading && !posts.data ? (
        <SkeletonRows rows={4} />
      ) : posts.error ? (
        <ErrorState message={posts.error.message} onRetry={posts.reload} />
      ) : !posts.data?.items.length ? (
        filtered ? (
          <EmptyState icon={<Search className="h-5 w-5" />} title="Eşleşen yazı yok" description="Filtreleri değiştirerek tekrar deneyin." />
        ) : (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Henüz yazı yok"
            description="Beslenme Rehberi’nde yayınlanacak ilk yazınızı oluşturun. Yazılar uzman onayı verilmeden yayınlanmaz."
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/panel/icerikler/blog/yeni')}>Yeni yazı</Button>}
          />
        )
      ) : (
        <>
          <ResponsiveTable
            rows={posts.data.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/panel/icerikler/blog/${r.id}`)}
            columns={[
              {
                key: 'title',
                header: 'Yazı',
                cell: (r) => (
                  <div className="min-w-0 max-w-md">
                    <p className="truncate font-semibold text-espresso">{r.title}</p>
                    <p className="truncate text-[0.78rem] text-panel-muted">/beslenme-rehberi/{r.slug}</p>
                  </div>
                ),
              },
              { key: 'cat', header: 'Kategori', cell: (r) => <span className="text-cocoa/80">{r.category?.name ?? '—'}</span> },
              {
                key: 'status',
                header: 'Durum',
                cell: (r) => (
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone={POST_TONE[r.status]}>{POST_STATUS_LABEL[r.status]}</Badge>
                    {r.expertReviewed && <ShieldCheck className="h-4 w-4 text-success-ink" aria-label="Uzman onaylı" />}
                  </span>
                ),
              },
              { key: 'updated', header: 'Son düzenleme', cell: (r) => <span className="tabular text-cocoa/80">{formatDate(r.updatedAt)}</span> },
            ]}
            mobileCard={(r) => (
              <div className="space-y-1.5">
                <p className="font-semibold text-espresso">{r.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-[0.78rem] text-panel-muted">
                  <Badge tone={POST_TONE[r.status]}>{POST_STATUS_LABEL[r.status]}</Badge>
                  {r.category?.name} · {formatDate(r.updatedAt)}
                </div>
              </div>
            )}
          />
          <Pagination page={page} pageSize={posts.data.pageSize} total={posts.data.total} onChange={setPage} />
        </>
      )}
    </Card>
  );
}
