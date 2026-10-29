import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './icon';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'ai';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  brand: 'bg-brand-soft text-brand-strong',
  ai: 'bg-spark-soft text-spark-ink',
};

const DEFAULT_ICON: Partial<Record<BadgeTone, IconName>> = {
  ok: 'check',
  warn: 'clock',
  danger: 'alert',
  info: 'info',
};

type BadgeProps = { tone?: BadgeTone; icon?: IconName | null; children: ReactNode };

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  const iconName = icon === null ? undefined : (icon ?? DEFAULT_ICON[tone]);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold leading-4',
        TONES[tone],
      )}
    >
      {tone === 'ai' && <span aria-hidden="true" className="size-1.5 rounded-full bg-spark" />}
      {iconName && <Icon name={iconName} size="sm" />}
      {children}
    </span>
  );
}
