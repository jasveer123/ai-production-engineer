import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' };

export function Card({ children, className, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-line bg-surface-raised p-6 shadow-raised max-sm:p-4',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type CardHeaderProps = { eyebrow?: string; title: ReactNode; aside?: ReactNode };

export function CardHeader({ eyebrow, title, aside }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-1 font-display text-lg font-semibold leading-7">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase leading-4 tracking-[0.06em] text-ink-muted">
      {children}
    </div>
  );
}
