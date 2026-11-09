// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Check } from 'lucide-react';
import { cn } from '@/lib/text';

export type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Görüşme', 'Zaman', 'Bilgileriniz'];

export function StepIndicator({ step, tone = 'light', vertical = false }: { step: Step; tone?: 'light' | 'dark'; vertical?: boolean }) {
  return (
    <ol className={cn('flex gap-3', vertical ? 'flex-col items-start' : 'items-center')} aria-label="Adımlar">
      {STEP_LABELS.map((l, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <li key={l} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-[0.72rem] font-semibold transition-colors',
                tone === 'dark'
                  ? done ? 'border-rose bg-rose text-espresso' : active ? 'border-rose text-rose' : 'border-cream/25 text-cream/60'
                  : done ? 'border-espresso bg-espresso text-cream' : active ? 'border-espresso text-espresso' : 'border-espresso/20 text-taupe',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={cn('text-[0.8rem] font-medium', vertical ? 'inline' : 'hidden sm:inline', tone === 'dark' ? (active ? 'text-cream' : 'text-cream/60') : active ? 'text-espresso' : 'text-taupe')}>{l}</span>
            {!vertical && i < STEP_LABELS.length - 1 && <span className={cn('h-px w-6 sm:w-10', tone === 'dark' ? 'bg-cream/20' : 'bg-espresso/15')} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

