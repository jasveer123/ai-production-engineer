import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type LiveState = 'live' | 'waiting' | 'error' | 'off';

const TEXT: Record<LiveState, string> = {
  live: 'text-ok',
  waiting: 'text-warn',
  error: 'text-danger',
  off: 'text-ink-muted',
};

const DOT: Record<LiveState, string> = {
  live: 'bg-ok',
  waiting: 'bg-warn animate-blink',
  error: 'bg-danger',
  off: 'bg-ink-muted',
};

type LiveStatusProps = { state: LiveState; children: ReactNode; detail?: ReactNode };

export function LiveStatus({ state, children, detail }: LiveStatusProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-semibold', TEXT[state])}>
      <span aria-hidden="true" className={cn('relative size-2 flex-none rounded-full', DOT[state])}>
        {state === 'live' && (
          <span className="animate-ping-soft absolute -inset-1 rounded-full border-2 border-ok opacity-50" />
        )}
      </span>
      {children}
      {detail && <span className="font-normal text-ink-muted">· {detail}</span>}
    </span>
  );
}
