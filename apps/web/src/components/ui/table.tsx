import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised shadow-raised">
      <table aria-label={label} className="w-full border-collapse text-sm leading-5">
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap bg-surface-sunken px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-t border-line px-4 py-3 align-middle', className)} {...rest} />;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="hover:[&>td]:bg-surface-hover">{children}</tr>;
}
