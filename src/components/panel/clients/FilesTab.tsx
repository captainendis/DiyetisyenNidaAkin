import { useRef, useState, type DragEvent } from 'react';
import { Download, FileText, ImageIcon, Lock, Trash2, UploadCloud } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDateTime } from '@/lib/format';
import { Card, EmptyState, ErrorState, IconButton, SkeletonRows, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { ConsentGate } from './ConsentGate';
import type { Client, ClientFile } from './types';

const MAX = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

export function FilesTab({ client, onClientChanged }: { client: Client; onClientChanged: (c: Client) => void }) {
  const { can } = usePanelAuth();
  const consent = !!client.healthConsentAt;
  const { data, error, loading, reload, setData } = useApi(() => api.get<{ items: ClientFile[] }>(`/clients/${client.id}/files`), [client.id]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { success, error: toastError, confirm } = useFeedback();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toastError(`${file.name} yüklenemedi`, 'Dosya en fazla 10 MB olabilir.');
        continue;
      }
      const form = new FormData();
      form.append('file', file);
      setUploading(file.name);
      try {
        const res = await api.upload<{ file: ClientFile }>(`/clients/${client.id}/files`, form);
        setData((d) => ({ items: [res.file, ...(d?.items ?? [])] }));
        success('Dosya yüklendi', file.name);
      } catch (e) {
        toastError(`${file.name} yüklenemedi`, (e as Error).message);
      }
    }
    setUploading(null);
    if (input.current) input.current.value = '';
  }

  async function remove(f: ClientFile) {
    if (!(await confirm({ title: 'Dosya silinsin mi?', description: `"${f.originalName}" kalıcı olarak silinecek.`, confirmLabel: 'Sil', tone: 'danger' }))) return;
    try {
      await api.del(`/clients/${client.id}/files/${f.id}`);
      setData((d) => ({ items: (d?.items ?? []).filter((x) => x.id !== f.id) }));
      success('Dosya silindi');
    } catch (e) {
      toastError('Silinemedi', (e as Error).message);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void upload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      {!consent && <ConsentGate client={client} onChanged={onClientChanged} what="sağlık belgeleri" />}
      {consent && can('clinical:write') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', drag ? 'border-cocoa bg-white' : 'border-panel-line bg-white/50')}
        >
          <UploadCloud className="mb-3 h-7 w-7 text-cocoa/60" aria-hidden />
          <p className="text-sm font-semibold text-espresso">{uploading ? `Yükleniyor: ${uploading}` : 'Dosyaları buraya sürükleyin'}</p>
          <p className="mt-1 text-[0.8rem] text-panel-muted">PDF, JPG, PNG veya WEBP · en fazla 10 MB · şifreli saklanır</p>
          <button type="button" disabled={!!uploading} onClick={() => input.current?.click()} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-cocoa ring-1 ring-panel-line ring-inset hover:bg-panel-bg disabled:opacity-50">
            Bilgisayardan seç
          </button>
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => void upload(e.target.files)} aria-label="Dosya seç" />
        </div>
      )}
      <Card>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data?.items.length ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="Henüz dosya yok." description={consent ? 'Tahlil sonuçları veya danışanın paylaştığı belgeler burada saklanabilir.' : 'Açık rıza kaydedildikten sonra dosya yüklenebilir.'} />
        ) : (
          <ul className="divide-y divide-panel-line">
            {data.items.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-bg text-cocoa/70">
                  {f.mimeType === 'application/pdf' ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-espresso">{f.originalName}</p>
                  <p className="tabular text-[0.75rem] text-panel-muted">
                    {size(f.sizeBytes)} · {formatDateTime(f.createdAt)}{f.uploadedBy ? ` · ${f.uploadedBy.firstName} ${f.uploadedBy.lastName}` : ''}
                  </p>
                </div>
                <IconButton label={`${f.originalName} indir`} onClick={() => api.download(`/clients/${client.id}/files/${f.id}/download`)}><Download className="h-4 w-4" /></IconButton>
                {can('clinical:write') && <IconButton label={`${f.originalName} sil`} onClick={() => void remove(f)}><Trash2 className="h-4 w-4" /></IconButton>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="flex items-center gap-1.5 text-[0.75rem] text-panel-muted"><Lock className="h-3.5 w-3.5" /> Dosyalar sunucuda şifrelenmiş olarak saklanır; yalnızca yetkili kullanıcılar indirebilir ve her indirme kayıt altına alınır.</p>
    </div>
  );
}
