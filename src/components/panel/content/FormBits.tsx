/** İçerik/ayar formları için ortak yerleşim parçaları */
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Card } from '@/components/panel/ui';
import { cn } from '@/lib/format';

/** Başlık + açıklama solda, alanlar sağda — uzun ayar sayfalarında taranabilirlik için */
export function FormSection({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-4 border-b border-panel-line px-5 py-6 last:border-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10 sm:px-6', className)}>
      <div>
        <h3 className="text-[0.9rem] font-bold text-espresso">{title}</h3>
        {description && <p className="mt-1 text-[0.8rem] leading-relaxed text-panel-muted">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

/** Kartın altında kaydet çubuğu — yalnızca değişiklik varken vurgulanır */
export function SaveBar({ dirty, saving, onSave, onReset, viewHref, note }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; viewHref?: string; note?: ReactNode }) {
  return (
    <div
      className={cn(
        'z-10 flex flex-wrap items-center gap-3 rounded-b-xl border-t px-5 py-3 transition-colors sm:px-6',
        dirty ? 'sticky bottom-0 border-warning/40 bg-[#fbf5ea] shadow-[0_-8px_24px_-16px_rgba(33,23,16,0.35)]' : 'border-panel-line bg-white',
      )}
    >
      <p className="mr-auto text-[0.8rem] text-panel-muted" aria-live="polite">
        {dirty ? <span className="font-semibold text-[#7d5720]">Kaydedilmemiş değişiklikler var</span> : note ?? 'Tüm değişiklikler kaydedildi'}
      </p>
      {viewHref && (
        <a href={viewHref} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-cocoa hover:underline">
          Sitede görüntüle <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {dirty && (
        <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
          Vazgeç
        </Button>
      )}
      <Button size="sm" onClick={onSave} loading={saving} disabled={!dirty}>
        Kaydet
      </Button>
    </div>
  );
}

export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('overflow-visible', className)}>{children}</Card>;
}

/** Karakter sayacı */
export function CharCount({ value, max }: { value: string | null | undefined; max: number }) {
  const n = value?.length ?? 0;
  return <span className={cn('tabular', n > max ? 'text-danger' : n > max * 0.9 ? 'text-[#93682a]' : 'text-panel-muted')}>{n}/{max}</span>;
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warning'; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-[0.82rem] leading-relaxed',
        tone === 'warning' ? 'border-warning/35 bg-warning/10 text-[#6f4d1d]' : 'border-panel-line bg-panel-bg text-cocoa/85',
        className,
      )}
    >
      {children}
    </div>
  );
}
