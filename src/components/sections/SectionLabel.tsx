import { cn } from '@/lib/format';

/** Editoryal bölüm etiketi: numara + ince çizgi + ad */
export function SectionLabel({ index, children, tone = 'dark', className }: { index?: string; children: string; tone?: 'dark' | 'light'; className?: string }) {
  return (
    <p className={cn('flex items-center gap-4 text-[0.7rem] font-semibold tracking-[0.24em] uppercase', tone === 'dark' ? 'text-taupe' : 'text-mist', className)}>
      {index && <span className={cn('font-display text-[0.95rem] tracking-normal italic', tone === 'dark' ? 'text-gold' : 'text-rose')}>{index}</span>}
      <span className={cn('h-px w-10', tone === 'dark' ? 'bg-gold/50' : 'bg-cream/30')} aria-hidden />
      {children}
    </p>
  );
}
