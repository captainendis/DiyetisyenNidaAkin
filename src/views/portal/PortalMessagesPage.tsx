// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect } from 'react';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import type { PortalMessage } from '@shared/portal';
import { Empty, LoadError, Loading, PortalPageHeader } from '@/components/portal/ui';

export default function PortalMessagesPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalMessage[] }>('/messages'), []);
  useEffect(() => {
    document.title = 'Mesajlar | Nida Akın';
  }, []);

  return (
    <>
      <PortalPageHeader title="Mesajlar" lead="Diyetisyeninin görüşmelerden sonra sana bıraktığı notlar ve öneriler." />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Henüz mesaj yok.">Diyetisyenin sana bir not bıraktığında burada göreceksin.</Empty>
      ) : (
        <ol className="space-y-4">
          {data.items.map((m) => (
            <li key={m.id}>
              <article className="rounded-lg bg-white p-5 ring-1 ring-espresso/[0.07] sm:p-6">
                <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.88rem] text-taupe">
                  <time dateTime={m.createdAt} className="font-semibold text-cocoa">{formatDate(m.createdAt)}</time>
                  {m.appointmentAt && <span>{formatDate(m.appointmentAt)} görüşmesi</span>}
                  {m.author && <span>{m.author}</span>}
                </header>
                <p className="text-[1.02rem] leading-relaxed whitespace-pre-line">{m.content}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
