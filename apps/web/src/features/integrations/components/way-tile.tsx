import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { LiveStatus } from '@/components/ui/live-status';
import { cn } from '@/lib/cn';
import { formatAgo } from '@/lib/format';
import type { SendWay, WayStatus } from '../ways';

const STATUS: Record<WayStatus, { state: 'live' | 'off' | 'error'; text: string }> = {
  receiving: { state: 'live', text: 'Receiving' },
  not_set_up: { state: 'off', text: 'Not set up' },
  silent: { state: 'error', text: 'Silent' },
};

function EffortMeter({ effort }: { effort: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <i
          key={n}
          className={cn(
            'h-2.5 w-1.5 rounded-[2px]',
            n <= effort ? 'bg-brand' : 'bg-line-strong opacity-35',
          )}
        />
      ))}
    </span>
  );
}

/** One way to send data: what it is, who it suits, how much work, and its live state. */
export function WayTile({
  way,
  status: state,
  lastReceivedAt,
}: {
  way: SendWay;
  status: WayStatus;
  lastReceivedAt: string | null;
}) {
  const status = STATUS[state];
  return (
    <article
      className={cn(
        'grid min-w-0 content-start gap-3 rounded-lg border bg-surface-raised p-6 shadow-raised transition hover:-translate-y-px hover:shadow-overlay max-sm:p-4',
        way.recommended ? 'border-brand shadow-[inset_0_0_0_1px_var(--brand)]' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Way {way.number}
        </span>
        {way.recommended && (
          <span className="ml-auto">
            <Badge tone="brand">Recommended</Badge>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-md bg-brand-soft text-brand-strong">
          <Icon name={way.icon} size="lg" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold leading-[22px]">{way.title}</h3>
          <p className="m-0 text-[13px] leading-5 text-ink-muted">{way.subtitle}</p>
        </div>
      </div>
      <p className="m-0 rounded-sm bg-surface-sunken px-2 py-1.5 text-[13px] leading-5">
        <b className="font-semibold">Best for:</b> {way.bestFor}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Setup facts">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink-muted">
          <Icon name="clock" size="sm" />
          {way.time}
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink-muted">
          <Icon name="code" size="sm" />
          {way.codeChange}
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink-muted">
          <EffortMeter effort={way.effort} />
          Effort {way.effort} of 3
        </li>
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <LiveStatus
          state={status.state}
          detail={lastReceivedAt ? formatAgo(lastReceivedAt) : undefined}
        >
          {status.text}
        </LiveStatus>
        <ButtonLink
          href={`/integrations/${way.slug}/`}
          size="sm"
          variant={state === 'not_set_up' ? 'primary' : 'secondary'}
        >
          {state === 'not_set_up' ? 'Set up' : 'Manage'}
        </ButtonLink>
      </div>
    </article>
  );
}
