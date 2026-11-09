// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

const control =
  'w-full rounded-lg border border-panel-line bg-white px-3 text-sm text-espresso placeholder:text-panel-muted transition-colors focus:border-cocoa focus:outline-none focus:ring-2 focus:ring-cocoa/10 disabled:bg-panel-bg disabled:text-panel-muted aria-[invalid=true]:border-danger';

export function Field({
  label, hint, error, required, children, className, htmlFor,
}: { label?: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[0.8rem] font-semibold text-cocoa">
          {label}
          {required && <span className="ml-0.5 text-danger-ink" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[0.78rem] text-danger-ink" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-[0.78rem] text-panel-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, wrapperClassName, className, id, required, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={inputId}>
      <input ref={ref} id={inputId} required={required} aria-invalid={!!error} className={cn(control, 'h-10', className)} {...rest} />
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string; wrapperClassName?: string };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, wrapperClassName, className, id, required, rows = 4, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={inputId}>
      <textarea ref={ref} id={inputId} rows={rows} required={required} aria-invalid={!!error} className={cn(control, 'py-2.5 leading-relaxed', className)} {...rest} />
    </Field>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: string; wrapperClassName?: string; options?: { value: string; label: string }[]; placeholder?: string };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, wrapperClassName, className, id, options, placeholder, children, required, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={inputId}>
      <select ref={ref} id={inputId} required={required} aria-invalid={!!error} className={cn(control, 'h-10 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23302219%27 stroke-width=%272%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={rest.id ?? id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-panel-line accent-cocoa" {...rest} />
      <label htmlFor={rest.id ?? id} className="text-sm text-cocoa">
        <span className="font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8rem] text-panel-muted">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      {label && (
        <label htmlFor={id} className="text-sm text-cocoa">
          <span className="font-medium">{label}</span>
          {description && <span className="mt-0.5 block text-[0.8rem] text-panel-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-success' : 'bg-panel-line')}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
