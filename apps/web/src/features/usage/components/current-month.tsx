import type { UsageSummary } from '@ape/api-contracts';
import { Card, Eyebrow } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatCount, formatPercent } from '@/lib/format';
import { budgetShare } from '../limits';
import { usd } from '../usd';

export function CurrentMonth({ summary }: { summary: UsageSummary }) {
  const month = summary.months[0];
  const cost = month?.aiCostUsd ?? 0;
  const budget = summary.limits.monthlyAiBudgetUsd;
  const share = budgetShare(cost, budget);
  const max = summary.limits.maxConcurrentInvestigations;
  return (
    <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
      <Card>
        <Eyebrow>AI cost this month</Eyebrow>
        <p className="m-0 mt-1 font-display text-2xl font-semibold tabular-nums">{usd(cost)}</p>
        {share === null ? (
          <p className="m-0 text-[13px] text-ink-muted">No monthly budget set</p>
        ) : (
          <>
            <p className="m-0 text-[13px] text-ink-muted">
              of {usd(budget!)} budget ({Number.isFinite(share) ? formatPercent(share) : 'over'})
            </p>
            <div
              role="meter"
              aria-label="Monthly AI budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(share * 100))}
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"
            >
              <div
                className={cn(
                  'h-full',
                  share >= 1 ? 'bg-danger' : share >= 0.8 ? 'bg-warn' : 'bg-brand',
                )}
                style={{ width: `${Math.min(100, share * 100)}%` }}
              />
            </div>
          </>
        )}
      </Card>
      <Card>
        <Eyebrow>Investigations running</Eyebrow>
        <p className="m-0 mt-1 font-display text-2xl font-semibold tabular-nums">
          {summary.runningInvestigations}
          {max !== null && <span className="text-base font-normal text-ink-muted"> / {max}</span>}
        </p>
        <p className="m-0 text-[13px] text-ink-muted">
          {max === null ? 'No limit on running at once' : 'Limit on running at once'}
        </p>
      </Card>
      <Card>
        <Eyebrow>Investigations this month</Eyebrow>
        <p className="m-0 mt-1 font-display text-2xl font-semibold tabular-nums">
          {formatCount(month?.investigations ?? 0)}
        </p>
        <p className="m-0 text-[13px] text-ink-muted">Runs that reached the AI model</p>
      </Card>
    </div>
  );
}
