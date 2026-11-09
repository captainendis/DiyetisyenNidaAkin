// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Sunum bileşenleri: Card, Badge, StatusBadge, Skeleton, EmptyState, ErrorState, PageHeader, Tabs, Pagination */
import type { ReactNode } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from '@shared/constants';
import { cn } from '@/lib/format';
import { Button } from './Button';

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('rounded-xl border border-panel-line bg-white', className)}>{children}</As>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[0.95rem] font-bold text-espresso">{title}</h2>
        {description && <p className="mt-0.5 text-[0.8rem] text-panel-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'dark';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-panel-bg text-cocoa ring-panel-line',
  success: 'bg-success/12 text-success-ink ring-success/25',
  warning: 'bg-warning/15 text-warning-ink ring-warning/30',
  danger: 'bg-danger/12 text-danger-ink ring-danger/25',
  info: 'bg-info/12 text-info-ink ring-info/25',
  accent: 'bg-rose/25 text-[#8d5646] ring-rose/40',
  dark: 'bg-cocoa text-ivory ring-cocoa',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-inset', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/** Randevu durum renkleri — takvim blokları da bu eşlemeyi kullanır */
export const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  NEW_REQUEST: 'accent',
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'dark',
  CANCELLED: 'danger',
  NO_SHOW: 'neutral',
};
/** Takvim blokları için arka plan / kenar renkleri */
export const STATUS_BLOCK: Record<AppointmentStatus, string> = {
  NEW_REQUEST: 'bg-rose/30 border-rose-deep text-[#6f4336]',
  PENDING: 'bg-warning/20 border-warning text-warning-ink',
  CONFIRMED: 'bg-success/18 border-success text-success-ink',
  COMPLETED: 'bg-cocoa/10 border-cocoa text-cocoa',
  CANCELLED: 'bg-danger/10 border-danger/60 text-danger-ink line-through decoration-danger/50',
  NO_SHOW: 'bg-panel-bg border-panel-muted text-panel-muted',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{APPOINTMENT_STATUS_LABEL[status]}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-panel-line/70', className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-panel-bg text-cocoa/75">{icon}</div>}
      <p className="font-display text-[1.35rem] font-medium text-espresso">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-panel-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <AlertCircle className="mb-3 h-6 w-6 text-danger-ink" aria-hidden />
      <p className="text-sm font-semibold text-espresso">Veriler yüklenemedi</p>
      <p className="mt-1 max-w-sm text-sm text-panel-muted">{message ?? 'Bağlantınızı kontrol edip tekrar deneyin.'}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Tekrar dene</Button>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[0.72rem] font-semibold tracking-[0.14em] text-panel-muted uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] leading-tight font-medium text-espresso sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-panel-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-panel-line px-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
            value === t.value ? 'border-cocoa text-espresso' : 'border-transparent text-panel-muted hover:text-cocoa',
          )}
        >
          {t.label}
          {t.count != null && <span className="tabular rounded bg-panel-bg px-1.5 text-[0.7rem] text-cocoa">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-panel-line px-5 py-3 text-sm text-panel-muted">
      <span className="tabular">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Önceki sayfa"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="tabular px-2 text-cocoa">{page} / {pages}</span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Sonraki sayfa"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toLocaleUpperCase('tr-TR')).join('');
  return (
    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-[0.78rem] font-bold text-cocoa', className)} aria-hidden>
      {ini}
    </span>
  );
}

/** Masaüstünde tablo, mobilde kart listesi */
export function ResponsiveTable<T>({
  rows, columns, rowKey, onRowClick, mobileCard,
}: {
  rows: T[];
  columns: { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; headerClassName?: string }[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCard: (row: T) => ReactNode;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-panel-line text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-5 py-3 font-semibold whitespace-nowrap', c.headerClassName)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('border-b border-panel-line/70 last:border-0', onRowClick && 'cursor-pointer transition-colors hover:bg-panel-bg/60')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3.5 align-middle', c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-panel-line md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            {onRowClick ? (
              <button type="button" onClick={() => onRowClick(r)} className="block w-full px-4 py-3.5 text-left active:bg-panel-bg">
                {mobileCard(r)}
              </button>
            ) : (
              <div className="px-4 py-3.5">{mobileCard(r)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
