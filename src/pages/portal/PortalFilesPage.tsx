// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect } from 'react';
import { Download, FileText, Image as ImageIcon } from 'lucide-react';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import type { PortalFile } from '@shared/portal';
import { Empty, LoadError, Loading, PortalPageHeader } from '@/components/portal/ui';

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`);

export default function PortalFilesPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalFile[] }>('/files'), []);
  useEffect(() => {
    document.title = 'Dosyalarım | Nida Akın';
  }, []);

  return (
    <>
      <PortalPageHeader title="Dosyalar" lead="Diyetisyeninin seninle paylaştığı belgeler." />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Paylaşılan dosya yok." />
      ) : (
        <ul className="divide-y divide-espresso/10 overflow-hidden rounded-2xl bg-white ring-1 ring-espresso/[0.07]">
          {data.items.map((f) => (
            <li key={f.id}>
              <a href={portalApi.url(`/files/${f.id}/download`)} className="flex items-center gap-4 px-5 py-4 hover:bg-espresso/[0.03]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-cocoa" aria-hidden>
                  {f.mimeType === 'application/pdf' ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.originalName}</span>
                  <span className="block text-[0.85rem] text-taupe tabular-nums">{size(f.sizeBytes)} · {formatDate(f.createdAt)}</span>
                </span>
                <Download className="h-5 w-5 shrink-0 text-cocoa" aria-label="İndir" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
