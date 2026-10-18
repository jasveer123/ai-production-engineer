import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { ApiError } from '@/lib/api';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/90',
  secondary: 'border border-line bg-surface hover:bg-muted',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  ghost: 'hover:bg-muted',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

const field =
  'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-accent';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cx(field, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cx(field, 'pr-8', className)} {...props} />;
  },
);

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-line bg-surface', className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-subtle">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const BADGE: Record<string, string> = {
  owner: 'bg-accent/15 text-accent',
  admin: 'bg-info/15 text-info',
  engineer: 'bg-ok/15 text-ok',
  viewer: 'bg-muted text-subtle',
  success: 'bg-ok/15 text-ok',
  denied: 'bg-danger/15 text-danger',
  failure: 'bg-warn/15 text-warn',
  critical: 'bg-danger text-white',
  high: 'bg-danger/15 text-danger',
  medium: 'bg-warn/15 text-warn',
  low: 'bg-muted text-subtle',
  connected: 'bg-ok/15 text-ok',
  pending: 'bg-warn/15 text-warn',
  error: 'bg-danger/15 text-danger',
  disconnected: 'bg-muted text-subtle',
  detected: 'bg-danger/15 text-danger',
  needs_attention: 'bg-danger/15 text-danger',
  validation_failed: 'bg-danger/15 text-danger',
  investigating: 'bg-info/15 text-info',
  fix_proposed: 'bg-info/15 text-info',
  validation: 'bg-info/15 text-info',
  awaiting_review: 'bg-accent/15 text-accent',
  monitoring: 'bg-accent/15 text-accent',
  verification_inconclusive: 'bg-warn/15 text-warn',
  resolved: 'bg-ok/15 text-ok',
  closed_without_fix: 'bg-muted text-subtle',
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={cx(
        'inline-flex rounded px-1.5 py-0.5 text-xs font-medium',
        BADGE[tone ?? ''] ?? 'bg-muted text-subtle',
      )}
    >
      {children}
    </span>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-subtle">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cx('px-4 py-3 align-middle', className)}>{children}</td>
);

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-subtle">{hint}</p>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-subtle" role="status">
      {label}
    </p>
  );
}

/** Shows an API error with its correlation ID so it can be found in logs and the audit trail. */
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const correlationId = error instanceof ApiError ? error.body.correlationId : undefined;
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {message}
      {correlationId && (
        <span className="ml-2 font-mono text-xs opacity-70">ref {correlationId.slice(0, 8)}</span>
      )}
    </div>
  );
}
