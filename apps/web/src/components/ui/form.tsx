import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface-raised px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:opacity-60 aria-[invalid=true]:border-danger';

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-msg`} className="text-[13px] leading-5 text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-msg`} className="text-[13px] leading-5 text-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={rest.id ? `${rest.id}-msg` : undefined}
      className={cn(CONTROL, className)}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(CONTROL, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
