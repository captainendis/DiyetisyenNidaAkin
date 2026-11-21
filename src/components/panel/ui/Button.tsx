// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-cocoa text-ivory hover:bg-espresso disabled:bg-cocoa/50',
  accent: 'bg-rose text-espresso hover:bg-rose-deep disabled:opacity-50',
  secondary: 'bg-white text-cocoa ring-1 ring-inset ring-panel-line hover:bg-panel-bg disabled:text-cocoa/40',
  ghost: 'text-cocoa hover:bg-cocoa/[0.06] disabled:text-cocoa/40',
  danger: 'bg-danger-ink text-white hover:bg-[#8c3632] disabled:opacity-50',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8rem] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-cocoa/70 transition-colors hover:bg-cocoa/[0.06] hover:text-cocoa disabled:cursor-not-allowed disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
