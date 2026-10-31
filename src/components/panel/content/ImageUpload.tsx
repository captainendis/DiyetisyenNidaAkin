/** Görsel yükleme: /api/content/media → herkese açık URL. Dosya türü sunucuda içerikten doğrulanır. */
import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, useFeedback } from '@/components/panel/ui';
import { cn } from '@/lib/format';

export function ImageUpload({ value, onChange, label = 'Görsel', aspect = 'aspect-[16/9]', hint }: { value: string | null | undefined; onChange: (url: string | null) => void; label?: string; aspect?: string; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return fb.error('Dosya çok büyük', 'En fazla 5 MB yükleyebilirsiniz.');
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const res = await api.upload<{ url: string }>('/content/media', form);
      onChange(res.url);
      fb.success('Görsel yüklendi');
    } catch (e) {
      fb.error('Görsel yüklenemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[0.8rem] font-semibold text-cocoa">{label}</p>
      <div className={cn('relative overflow-hidden rounded-lg border border-dashed border-panel-line bg-panel-bg', aspect)}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-panel-muted hover:text-cocoa"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-[0.8rem] font-medium">Görsel seçin</span>
            <span className="text-[0.72rem]">JPG, PNG, WebP veya AVIF · en fazla 5 MB</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" loading={busy} icon={<ImagePlus className="h-4 w-4" />} onClick={() => input.current?.click()}>
          {value ? 'Değiştir' : 'Yükle'}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => onChange(null)}>
            Kaldır
          </Button>
        )}
        {hint && <span className="text-[0.75rem] text-panel-muted">{hint}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}
