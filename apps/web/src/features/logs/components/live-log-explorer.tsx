'use client';

import type { LogLine as ApiLogLine } from '@ape/api-contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { LiveStatus } from '@/components/ui/live-status';
import { errorMessage } from '@/lib/api';
import { formatCount, formatLogTime } from '@/lib/format';
import { useLogSearch } from '../queries';
import type { LogLine } from '../types';
import { LogHistogram } from './log-histogram';
import { LogViewer } from './log-viewer';

const RANGES = [
  { value: '15m', label: 'Last 15 minutes', ms: 15 * 60_000 },
  { value: '1h', label: 'Last hour', ms: 3600_000 },
  { value: '24h', label: 'Last 24 hours', ms: 86_400_000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 86_400_000 },
] as const;
const SUGGESTIONS = ['level:error,fatal', 'way:drain', 'env:production', '"timeout"'];
const WAY_LABEL: Record<string, LogLine['source']> = {
  otlp: 'OpenTelemetry',
  package: 'Our package',
  agent: 'Server agent',
};

/** API lines to the viewer's shape (it has four levels; trace counts as debug, fatal as error). */
export function toViewerLine(l: ApiLogLine): LogLine {
  return {
    id: String(l.id),
    at: l.ts,
    level: l.level === 'fatal' ? 'error' : l.level === 'trace' ? 'debug' : l.level,
    service: l.service,
    message: l.message,
    traceId: l.traceId ?? undefined,
    source: WAY_LABEL[l.way] ?? 'Server agent',
  };
}

export function LiveLogExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';
  const range = RANGES.find((r) => r.value === params.get('range')) ?? RANGES[1];
  const [live, setLive] = useState(true);
  // The window end moves forward on every live refresh.
  const [to, setTo] = useState(() => Date.now());

  useEffect(() => setDraft(q), [q]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`);
  };

  const query = useLogSearch({ q, range: range.value, rangeMs: range.ms, to });

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setTo(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [live]);

  const first = query.data?.pages[0];
  const lines = (query.data?.pages ?? []).flatMap((p) => p.lines).map(toViewerLine);
  const histogram = (first?.histogram ?? []).map((b) => ({
    start: b.at,
    total: b.total,
    errors: b.errors,
  }));
  const total = histogram.reduce((n, b) => n + b.total, 0);
  const errors = histogram.reduce((n, b) => n + b.errors, 0);
  const labels: [string, string, string] = histogram.length
    ? ([
        histogram[0]!.start,
        histogram[Math.floor(histogram.length / 2)]!.start,
        new Date(to).toISOString(),
      ].map((t) => formatLogTime(t).slice(0, 5)) as [string, string, string])
    : ['', '', ''];
  const service = /(?:^|\s)service:(\S+)/.exec(q)?.[1] ?? '';

  return (
    <>
      <Card className="grid gap-3 !p-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', draft.trim());
          }}
        >
          <div className="relative min-w-0 flex-[1_1_320px]">
            <label htmlFor="log-query" className="sr-only">
              Search logs
            </label>
            <span className="pointer-events-none absolute left-3 top-[11px] text-ink-muted">
              <Icon name="search" size="sm" />
            </span>
            <input
              id="log-query"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='level:error service:checkout-api "timeout"'
              className="h-10 w-full rounded-md border border-line-strong bg-surface-raised pl-9 pr-3 font-mono text-[13px] text-ink placeholder:text-ink-muted focus:border-brand"
            />
          </div>
          <label htmlFor="log-service" className="sr-only">
            Service
          </label>
          <select
            id="log-service"
            value={service}
            onChange={(e) =>
              setParam(
                'q',
                `${q.replace(/(?:^|\s)service:\S+/g, '').trim()}${e.target.value ? ` service:${e.target.value}` : ''}`.trim(),
              )
            }
            className="h-10 rounded-md border border-line-strong bg-surface-raised px-3 text-sm text-ink"
          >
            <option value="">All services ({first?.services.length ?? 0})</option>
            {first?.services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label htmlFor="log-range" className="sr-only">
            Time range
          </label>
          <select
            id="log-range"
            value={range.value}
            onChange={(e) => setParam('range', e.target.value)}
            className="h-10 rounded-md border border-line-strong bg-surface-raised px-3 text-sm text-ink"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button type="submit">Search</Button>
          <Button variant="secondary" onClick={() => setLive((v) => !v)} aria-pressed={!live}>
            <Icon name={live ? 'pause' : 'play'} size="sm" />
            {live ? 'Pause' : 'Resume'}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-ink-muted">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setParam('q', s)}
              className="rounded-sm bg-surface-sunken px-2 py-0.5 font-mono text-xs text-ink-muted hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {query.isError && (
        <Banner tone="danger" title="Search failed.">
          {errorMessage(query.error)}
        </Banner>
      )}

      <Card className="!p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>{formatCount(total)} logs</b>{' '}
            <span className="text-[13px] text-ink-muted">
              · {formatCount(errors)} errors in {range.label.toLowerCase()}
            </span>
          </div>
          <LiveStatus
            state={live ? 'live' : 'off'}
            detail={live ? 'refreshes every 5 s' : undefined}
          >
            {live ? 'Live' : 'Paused'}
          </LiveStatus>
        </div>
        {histogram.length > 0 && <LogHistogram buckets={histogram} labels={labels} />}
      </Card>

      {query.isPending ? (
        <p className="text-ink-muted">Searching…</p>
      ) : lines.length > 0 ? (
        <>
          <LogViewer lines={lines} label="Log lines, newest first" />
          {query.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load older lines'}
              </Button>
            </div>
          )}
        </>
      ) : q ? (
        <EmptyState icon="search" title="No logs match this search">
          Remove a filter, widen the time range, or try a shorter word. Searches look at the
          message, level, service, environment, host and trace id.
        </EmptyState>
      ) : (
        <EmptyState
          icon="plug"
          title="No logs yet"
          action={<ButtonLink href="/integrations/">Connect an app</ButtonLink>}
        >
          Send logs with any of the 7 ways on the Integrations page. They show up here within
          seconds.
        </EmptyState>
      )}
    </>
  );
}
