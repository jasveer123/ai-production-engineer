import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

type EmptyStateProps = { icon: IconName; title: string; children: ReactNode; action?: ReactNode };

/** Nothing here yet, and how to fill it. Never a dead end. */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-raised px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-lg bg-brand-soft text-brand-strong">
        <Icon name={icon} size="lg" />
      </span>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="m-0 max-w-[44ch] text-ink-muted">{children}</p>
      {action}
    </div>
  );
}
