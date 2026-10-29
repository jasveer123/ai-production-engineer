'use client';

import type { VerificationRunView } from '@ape/api-contracts';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDateTime } from '@/lib/format';
import { useVerification } from '../queries';

const OUTCOME = {
  recovered: { tone: 'ok', label: 'Recovered' },
  not_recovered: { tone: 'danger', label: 'Not recovered' },
  inconclusive: { tone: 'warn', label: 'Inconclusive' },
} as const;

export function IncidentRecovery({ id }: { id: string }) {
  const verification = useVerification(id);
  if (verification.isPending) return <ListSkeleton label="Loading" />;
  if (verification.isError)
    return (
      <Banner tone="danger" title="Could not load the recovery check.">
        {errorMessage(verification.error)}
      </Banner>
    );
  const { runs, awaitingDeploy } = verification.data;

  if (runs.length === 0)
    return (
      <EmptyState icon="radio" title="Recovery check has not started">
        {awaitingDeploy
          ? `Pull request ${awaitingDeploy.prNumber ? `#${awaitingDeploy.prNumber} ` : ''}is merged. We start watching once a deploy containing it arrives.`
          : 'After the fix is merged and deployed, we watch this error and compare it with before the fix.'}
      </EmptyState>
    );

  return (
    <div className="grid gap-4">
      {runs.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </div>
  );
}

function RunCard({ run }: { run: VerificationRunView }) {
  const outcome = run.outcome ? OUTCOME[run.outcome] : null;
  const rows = [
    { label: 'Before the fix', value: run.baseline?.errors ?? 0, bar: 'bg-danger' },
    { label: 'After the deploy', value: run.observed?.errors ?? 0, bar: 'bg-ok' },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <Card as="section" className="grid gap-4">
      <CardHeader
        eyebrow={`Window ${run.window}`}
        title={`Deploy ${run.deployVersion ?? run.deployCommitSha.slice(0, 7)}`}
        aside={
          outcome ? (
            <Badge tone={outcome.tone}>{outcome.label}</Badge>
          ) : (
            <Badge tone="info">Watching</Badge>
          )
        }
      />
      {run.reason && <p className="m-0 max-w-[72ch]">{run.reason}</p>}
      <dl className="m-0 grid gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[150px_minmax(0,1fr)_64px] items-center gap-3 max-sm:grid-cols-[1fr_auto]"
          >
            <dt className="text-sm">{row.label}</dt>
            <dd className="m-0 h-3 overflow-hidden rounded-full bg-surface-sunken max-sm:order-last max-sm:col-span-2">
              <span
                className={`block h-full rounded-full ${row.bar}`}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </dd>
            <dd className="m-0 text-right font-semibold tabular-nums">{formatCount(row.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[13px] text-ink-muted">
        {run.windowStartedAt ? `From ${formatDateTime(run.windowStartedAt)}` : 'Not started'}
        {run.windowEndedAt ? ` to ${formatDateTime(run.windowEndedAt)}` : ''}
        {run.observed?.requests != null
          ? `, ${formatCount(run.observed.requests)} requests seen`
          : ''}
        . Nothing is rolled back automatically.
      </p>
    </Card>
  );
}
