// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı (Hesabım) için küçük arayüz parçaları.
 * Zemin ivory, metin espresso/cocoa; açık zeminde vurgu için yalnızca "-ink" tonları (bkz. index.css kontrast kuralı).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/text';

export function PortalPageHeader({ title, lead, back, actions }: { title: ReactNode; lead?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="mb-8 sm:mb-10">
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-taupe hover:text-espresso">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display nums text-[2.3rem] leading-[1.05] font-medium text-espresso sm:text-[2.9rem]">{title}</h1>
          {lead && <div className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-cocoa">{lead}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Beyaz kart; içerik bölümleri için */
export function Panel({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'article' | 'div' | 'li' }) {
  return <As className={cn('rounded-lg bg-white p-5 ring-1 ring-espresso/[0.07] sm:p-6', className)}>{children}</As>;
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.92rem] font-semibold text-taupe">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-espresso/15 px-6 py-12 text-center">
      <p className="font-display text-[1.5rem] text-espresso">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[0.95rem] leading-relaxed text-taupe">{children}</div>}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/[0.06] px-6 py-8 text-center">
      <p className="font-semibold text-danger-ink">{message || 'Bilgiler yüklenemedi.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-[0.9rem] font-semibold text-espresso underline underline-offset-4">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-espresso/[0.06]" />
      ))}
    </div>
  );
}

/** Birincil eylem (ör. PDF indir). Koyu zemin + açık metin; site CTA'sından daha sakin. */
export function PortalButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-espresso px-5 text-[0.92rem] font-semibold text-ivory transition-colors hover:bg-cocoa disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PortalLinkButton({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.92rem] font-semibold text-espresso ring-1 ring-espresso/20 transition-colors ring-inset hover:bg-espresso/[0.05]', className)}>
      {children}
    </Link>
  );
}
