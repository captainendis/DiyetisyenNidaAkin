// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useId, useState } from 'react';
import type { PublicFaq } from '@/data/types';
import { cn } from '@/lib/text';

/** Erişilebilir akordeon SSS listesi */
export function FaqList({ faqs, tone = 'light' }: { faqs: PublicFaq[]; tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  const base = useId();
  if (!faqs.length) return null;
  return (
    <ul className={cn('border-b', tone === 'dark' ? 'border-cream/12' : 'border-espresso/12')}>
      {faqs.map((f) => {
        const isOpen = open === f.id;
        const id = `${base}-${f.id}`;
        return (
          <li key={f.id} className={cn('border-t', tone === 'dark' ? 'border-cream/12' : 'border-espresso/12')}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="flex w-full items-start justify-between gap-6 py-6 text-left"
              >
                <span className="font-display text-[1.4rem] leading-snug sm:text-[1.6rem]">{f.question}</span>
                <span className="relative mt-3 h-3 w-3 shrink-0" aria-hidden>
                  <span className="absolute top-1/2 left-0 h-px w-3 bg-current" />
                  <span className={cn('absolute top-0 left-1/2 h-3 w-px bg-current transition-transform duration-500', isOpen && 'scale-y-0')} />
                </span>
              </button>
            </h3>
            <div id={id} role="region" hidden={!isOpen} className="pb-7">
              <p className={cn('max-w-2xl text-[1rem] leading-[1.8]', tone === 'dark' ? 'text-cream/75' : 'text-cocoa/80')}>{f.answer}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
