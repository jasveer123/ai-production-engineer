import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './icon';

export type BannerTone = 'ok' | 'danger' | 'info' | 'ai';

const STYLE: Record<BannerTone, { box: string; icon: string; name: IconName }> = {
  ok: { box: 'bg-ok-soft', icon: 'text-ok', name: 'check' },
  danger: { box: 'bg-danger-soft', icon: 'text-danger', name: 'alert' },
  info: { box: 'bg-info-soft', icon: 'text-info', name: 'info' },
  ai: { box: 'bg-spark-soft', icon: 'text-spark-ink', name: 'spark' },
};

type BannerProps = { tone: BannerTone; title: ReactNode; children?: ReactNode };

export function Banner({ tone, title, children }: BannerProps) {
  const s = STYLE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md px-4 py-3 text-sm leading-5 text-ink',
        s.box,
      )}
    >
      <Icon name={s.name} className={cn('mt-px', s.icon)} />
      <div className="min-w-0">
        <b className="font-semibold">{title}</b> {children}
      </div>
    </div>
  );
}
