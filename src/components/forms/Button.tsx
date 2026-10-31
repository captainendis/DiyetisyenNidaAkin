/**
 * Herkese açık site düğmeleri.
 * Birincil CTA: rose, hap biçimli (sitede hap biçimini taşıyan TEK öğe — bilinçli vurgu).
 * İkincil: alt çizgili metin bağlantısı.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/text';

type Tone = 'rose' | 'cream' | 'dark';
const tones: Record<Tone, string> = {
  rose: 'bg-rose text-espresso hover:bg-[#e6bdb0]',
  cream: 'bg-cream text-espresso hover:bg-ivory',
  dark: 'bg-espresso text-cream hover:bg-cocoa',
};

const ctaBase =
  'group relative inline-flex items-center justify-center gap-3 rounded-pill font-medium tracking-[0.01em] transition-[background-color,transform,box-shadow] duration-300 ease-[var(--ease-soft)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

const sizes = { md: 'h-12 px-6 text-[0.95rem]', lg: 'h-14 px-8 text-[1rem]' };

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-300 ease-[var(--ease-soft)] group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export interface CtaProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: 'md' | 'lg';
  withIcon?: boolean;
  chevron?: boolean;
}

export const CtaButton = forwardRef<HTMLButtonElement, CtaProps>(function CtaButton(
  { tone = 'rose', size = 'md', withIcon = true, chevron = true, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(ctaBase, tones[tone], sizes[size], className)} {...rest}>
      {withIcon && <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />}
      <span>{children}</span>
      {chevron && <Chevron />}
    </button>
  );
});

export function CtaLink({ tone = 'rose', size = 'md', className, children, ...rest }: LinkProps & { tone?: Tone; size?: 'md' | 'lg'; children: ReactNode }) {
  return (
    <Link className={cn(ctaBase, tones[tone], sizes[size], className)} {...rest}>
      <span>{children}</span>
      <Chevron />
    </Link>
  );
}

/** İnce alt çizgili metin bağlantısı; hover'da çizgi uzar */
export function TextLink({ className, children, tone = 'light', ...rest }: LinkProps & { tone?: 'light' | 'dark'; children: ReactNode }) {
  return (
    <Link
      className={cn(
        'group inline-flex items-center gap-2.5 py-2 text-[0.95rem] font-medium',
        tone === 'light' ? 'text-cream' : 'text-espresso',
        className,
      )}
      {...rest}
    >
      <span className="relative">
        {children}
        <span className={cn('absolute -bottom-1 left-0 h-px w-full origin-left scale-x-[0.35] transition-transform duration-500 ease-[var(--ease-soft)] group-hover:scale-x-100', tone === 'light' ? 'bg-rose' : 'bg-espresso')} />
      </span>
      <Chevron />
    </Link>
  );
}
