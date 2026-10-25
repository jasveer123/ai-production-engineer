'use client';

import type { TimelineEntry } from '@ape/api-contracts';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { groupTimeline } from '../live';
import { useTimeline } from '../queries';

const KIND: Record<TimelineEntry['kind'], { icon: IconName; tone: string; label: string }> = {
  error: { icon: 'alert', tone: 'bg-danger-soft text-danger', label: 'Error' },
  alert: { icon: 'bell', tone: 'bg-danger-soft text-danger', label: 'Alert' },
  created: { icon: 'flame', tone: 'bg-warn-soft text-ink', label: 'Incident opened' },
  status_change: { icon: 'users', tone: 'bg-brand-soft text-brand-strong', label: 'Status' },
  investigation: { icon: 'spark', tone: 'bg-spark-soft text-spark-ink', label: 'AI' },
  fix: { icon: 'code', tone: 'bg-spark-soft text-spark-ink', label: 'Fix' },
  verification: { icon: 'radio', tone: 'bg-ok-soft text-ok', label: 'Recovery' },
  deploy: { icon: 'git', tone: 'bg-info-soft text-info', label: 'Deploy' },
};

/** Everything that happened, oldest first: errors, deploys, AI steps and human decisions. */
export function IncidentTimeline({ id }: { id: string }) {
  const timeline = useTimeline(id);
  if (timeline.isPending) return <p className="text-ink-muted">Loading the timeline…</p>;
  if (timeline.isError)
    return (
      <Banner tone="danger" title="Could not load the timeline.">
        {errorMessage(timeline.error)}
      </Banner>
    );
  if (timeline.data.length === 0)
    return (
      <EmptyState icon="clock" title="Nothing on the timeline yet">
        Errors, deploys and every status change will appear here as they happen.
      </EmptyState>
    );

  const rows = groupTimeline(timeline.data);
  return (
    <Card as="section" aria-label="Timeline">
      <ol className="m-0 grid list-none p-0">
        {rows.map(({ entry: e, count, lastAt }, i) => {
          const kind = KIND[e.kind];
          return (
            <li
              key={`${e.kind}-${e.id}`}
              className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
            >
              {i < rows.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[17px] top-9 w-px bg-line"
                />
              )}
              <span className={cn('grid size-9 place-items-center rounded-full', kind.tone)}>
                <Icon name={kind.icon} size="sm" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="m-0 font-semibold">
                  {e.kind === 'deploy'
                    ? `Deploy ${e.version ?? e.commitSha.slice(0, 7)} to ${e.environment}`
                    : (e.summary ?? kind.label)}
                  {count > 1 && (
                    <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-semibold text-danger">
                      ×{count}
                    </span>
                  )}
                </p>
                <p className="m-0 text-[13px] text-ink-muted">
                  <time dateTime={e.at}>{formatDateTime(e.at)}</time>
                  {count > 1 && (
                    <>
                      {' to '}
                      <time dateTime={lastAt}>{formatDateTime(lastAt)}</time>
                    </>
                  )}
                  , {kind.label.toLowerCase()}
                  {e.kind !== 'deploy' && e.actorEmail ? ` by ${e.actorEmail}` : ''}
                  {e.kind !== 'deploy' && e.traceId && count === 1
                    ? `, trace ${e.traceId.slice(0, 12)}`
                    : ''}
                  {e.kind !== 'deploy' && e.sourceUrl && (
                    <>
                      {' '}
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Open source
                      </a>
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
