'use client';

import { TRAFFIC_COUNT_CAP, type VerificationRunView } from '@ape/api-contracts';
import { Badge, Card } from '@/components/ui';
import { useVerification } from '@/lib/queries';

const OUTCOME: Record<
  NonNullable<VerificationRunView['outcome']>,
  { tone: string; text: string }
> = {
  recovered: { tone: 'resolved', text: 'Recovered' },
  not_recovered: { tone: 'needs_attention', text: 'Not recovered' },
  inconclusive: { tone: 'verification_inconclusive', text: 'Inconclusive' },
};

const mins = (ms: number) => `${Math.round(ms / 60_000)} min`;
/** 14229.12 -> 14,229; 2.47 -> 2.5. */
const rate = (v: number) =>
  v >= 100 ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Run({ run }: { run: VerificationRunView }) {
  const o = run.observed;
  const b = run.baseline;
  const until = run.windowEndedAt ? new Date(run.windowEndedAt) : null;
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {run.outcome ? (
          <Badge tone={OUTCOME[run.outcome].tone}>{OUTCOME[run.outcome].text}</Badge>
        ) : (
          <Badge tone="pending">Observing</Badge>
        )}
        <span className="text-subtle">
          Window {run.window} · deploy {run.deployVersion ?? run.deployCommitSha.slice(0, 7)}
          {run.status === 'observing' && until && ` · until ${until.toLocaleTimeString()}`}
        </span>
      </div>
      {run.reason && <p className="mt-1.5 text-sm">{run.reason}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Errors before the fix"
          value={b ? `${rate(b.errorsPerHour)}/h` : '—'}
          hint={b ? `${b.errors} in ${mins(b.durationMs)}` : undefined}
        />
        <Stat
          label="Same error after the deploy"
          value={o ? String(o.errors) : '—'}
          hint={o ? `in ${mins(o.durationMs)}` : undefined}
        />
        <Stat
          label="Expected if not fixed"
          value={o ? `~${rate(o.expectedErrors)}` : '—'}
          hint="at the pre-fix rate"
        />
        <Stat
          label="Requests observed"
          value={
            o?.requests == null
              ? 'unknown'
              : o.requests >= TRAFFIC_COUNT_CAP
                ? `${TRAFFIC_COUNT_CAP.toLocaleString()}+`
                : String(o.requests)
          }
          hint={o?.operation ?? undefined}
        />
      </div>
    </div>
  );
}

/** Phase 7: was the incident actually fixed in production after the PR merged and deployed? */
export function VerificationPanel({ ws, incidentId }: { ws: string; incidentId: string }) {
  const q = useVerification(ws, incidentId);
  const data = q.data;
  if (!data || (data.runs.length === 0 && !data.awaitingDeploy)) return null;
  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Recovery verification</p>
        <p className="text-xs text-subtle">The platform never rolls back on its own.</p>
      </div>
      {data.awaitingDeploy && (
        <p className="mb-3 text-sm text-subtle">
          Pull request {data.awaitingDeploy.prNumber ? `#${data.awaitingDeploy.prNumber} ` : ''}
          merged
          {data.awaitingDeploy.mergeCommitSha &&
            ` as ${data.awaitingDeploy.mergeCommitSha.slice(0, 7)}`}
          . Waiting for a deploy that contains it.
        </p>
      )}
      <div className="space-y-3">
        {data.runs.map((r) => (
          <Run key={r.id} run={r} />
        ))}
      </div>
    </Card>
  );
}
