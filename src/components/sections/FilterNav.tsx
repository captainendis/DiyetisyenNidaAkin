// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * Liste sayfalarındaki filtreler (kategori, diyet türü).
 * Geniş ekranda yatay sekmeler; telefonda seçili değeri gösteren açılır kapanır satır.
 * Seçenekler her iki durumda da gerçek bağlantıdır (taranabilir, JS olmadan çalışır).
 */
import { useRef } from 'react';
import { Link } from '@/lib/router';
import { cn } from '@/lib/text';

export type FilterItem = { key: string; label: string; to: string; active: boolean };

export function FilterNav({ label, items, variant = 'tabs', className }: { label: string; items: FilterItem[]; variant?: 'tabs' | 'inline'; className?: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  const current = items.find((i) => i.active) ?? items[0];
  const close = () => {
    if (details.current) details.current.open = false;
  };

  return (
    <nav aria-label={label} className={className}>
      <details ref={details} className="group border-y border-espresso/12 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso [&::-webkit-details-marker]:hidden">
          <span className="text-[0.9rem] text-taupe">{label}</span>
          <span className="flex items-center gap-2 text-[0.98rem] text-espresso">
            {current?.label}
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180">
              <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>
        <ul className="pb-3">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                to={i.to}
                onClick={close}
                aria-current={i.active ? 'page' : undefined}
                className={cn('flex items-center justify-between py-3 text-[1rem]', i.active ? 'font-semibold text-espresso' : 'text-cocoa')}
              >
                {i.label}
                {i.active && (
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
                    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </details>

      <ul className={cn('hidden sm:flex', variant === 'tabs' ? 'flex-wrap gap-x-7 border-b border-espresso/12' : 'flex-wrap items-center gap-x-6 gap-y-2')}>
        {variant === 'inline' && <li className="text-[0.9rem] text-taupe">{label}:</li>}
        {items.map((i) => (
          <li key={i.key}>
            <Link
              to={i.to}
              aria-current={i.active ? 'page' : undefined}
              className={cn(
                'block border-b transition-colors',
                variant === 'tabs' ? '-mb-px py-4 text-[0.92rem]' : 'py-1 text-[0.9rem]',
                i.active ? 'border-espresso text-espresso' : 'border-transparent text-taupe hover:text-espresso',
              )}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
