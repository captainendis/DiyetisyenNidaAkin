// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect } from 'react';
import { Link } from 'react-router';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import type { PortalPlanListItem } from '@shared/portal';
import { Empty, LoadError, Loading, PortalPageHeader } from '@/components/portal/ui';

export default function PortalPlansPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalPlanListItem[] }>('/plans'), []);
  useEffect(() => {
    document.title = 'Listelerim | Nida Akın';
  }, []);

  return (
    <>
      <PortalPageHeader title="Listelerim" lead="Sana verilen beslenme listeleri, en yenisi en üstte. Her öğünde seçeneklerden yalnızca birini seç." />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Henüz listen yok.">Görüşmeden sonra beslenme listen burada görünecek.</Empty>
      ) : (
        <ol className="space-y-3">
          {data.items.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-espresso/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Link to={`/hesabim/listeler/${p.id}`} className="font-display nums text-[1.6rem] leading-tight font-medium hover:underline hover:underline-offset-4">{p.name}</Link>
                  {i === 0 && <span className="rounded-full bg-espresso px-2.5 py-0.5 text-[0.75rem] font-semibold text-ivory">Güncel</span>}
                </p>
                <p className="mt-1 text-[0.9rem] text-taupe">{formatDate(p.createdAt)} tarihinde verildi</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/hesabim/listeler/${p.id}`} className="inline-flex h-11 items-center rounded-full bg-espresso px-5 text-[0.92rem] font-semibold text-ivory hover:bg-cocoa">Aç</Link>
                <a href={portalApi.url(`/plans/${p.id}/pdf`)} className="inline-flex h-11 items-center rounded-full px-5 text-[0.92rem] font-semibold text-espresso ring-1 ring-espresso/20 ring-inset hover:bg-espresso/[0.05]">PDF</a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
