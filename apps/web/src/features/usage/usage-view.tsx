'use client';

import type { UsageSummary, WorkspaceLimits } from '@ape/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, Eyebrow } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, formatPercent } from '@/lib/format';
import { formatMoney } from '@/features/business/money';
import { budgetShare, parseLimits } from './limits';

const usd = (v: number) => formatMoney(v, 'USD');

export function UsageView() {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const key = ['ws', workspace.id, 'usage'];
  const usage = useQuery({
    queryKey: key,
    queryFn: () => api<UsageSummary>(`/workspaces/${workspace.id}/usage`),
    enabled: can('admin'),
  });

  if (!can('admin')) {
    return (
      <>
        <PageHeader title="Usage" />
        <Banner tone="info" title="Only admins and owners can see usage.">
          Ask a workspace owner if you need to know how much AI time has been used.
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Usage"
        description="AI and sandbox use by month, and the limits that stop costs from running away. Every investigation, automatic or manual, checks these limits before it starts."
      />
      {usage.isPending ? (
        <p className="text-ink-muted">Loading usage…</p>
      ) : usage.isError ? (
        <Banner tone="danger" title="Could not load usage.">
          {errorMessage(usage.error)}
        </Banner>
      ) : (
        <>
          {usage.data.blockedReason && (
            <Banner tone="danger" title="New investigations are blocked.">
              Right now {usage.data.blockedReason}
            </Banner>
          )}
          <CurrentMonth summary={usage.data} />
          <LimitsForm
            key={JSON.stringify(usage.data.limits)}
            limits={usage.data.limits}
            canEdit={can('owner')}
            workspaceId={workspace.id}
            onSaved={(next) => qc.setQueryData(key, next)}
          />
          <section aria-labelledby="usage-months" className="grid gap-3">
            <h2 id="usage-months" className="m-0 font-display text-xl font-semibold">
              By month
            </h2>
            <Table label="Usage by month">
              <thead>
                <tr>
                  <Th>Month (UTC)</Th>
                  <Th className="text-right">Investigations</Th>
                  <Th className="text-right">Input tokens</Th>
                  <Th className="text-right">Output tokens</Th>
                  <Th className="text-right">AI cost</Th>
                  <Th className="text-right">Sandbox minutes</Th>
                </tr>
              </thead>
              <tbody>
                {usage.data.months.map((m) => (
                  <Tr key={m.month}>
                    <Td className="font-semibold">{m.month}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.investigations)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.inputTokens)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.outputTokens)}</Td>
                    <Td className="text-right tabular-nums">{usd(m.aiCostUsd)}</Td>
                    <Td className="text-right tabular-nums">{formatCount(m.sandboxMinutes)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="m-0 text-[13px] text-ink-muted">
              AI cost is what the model provider charges for investigation reports, from the token
              counts each run reports. Sandbox minutes are the time spent running tests for fixes.
            </p>
          </section>
        </>
      )}
    </>
  );
}

function CurrentMonth({ summary }: { summary: UsageSummary }) {
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

function LimitsForm({
  limits,
  canEdit,
  workspaceId,
  onSaved,
}: {
  limits: WorkspaceLimits;
  canEdit: boolean;
  workspaceId: string;
  onSaved: (s: UsageSummary) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (body: WorkspaceLimits) =>
      api<UsageSummary>(`/workspaces/${workspaceId}/usage/limits`, { method: 'PUT', json: body }),
    onSuccess: (next) => (setSaved(true), onSaved(next)),
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card as="section" className="grid gap-4">
      <div>
        <h2 className="m-0 font-display text-xl font-semibold">Limits</h2>
        <p className="m-0 text-[13px] text-ink-muted">
          {canEdit
            ? 'Leave a field empty for no limit. A blocked investigation shows why on the incident timeline and in the audit log.'
            : 'Only the workspace owner can change limits.'}
        </p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          const f = new FormData(e.currentTarget);
          const parsed = parseLimits(String(f.get('budget')), String(f.get('concurrent')));
          if (typeof parsed === 'string') setError(parsed);
          else save.mutate(parsed);
        }}
      >
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field id="limit-budget" label="Monthly AI budget (USD)">
            <Input
              id="limit-budget"
              name="budget"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="No budget"
              disabled={!canEdit}
              defaultValue={limits.monthlyAiBudgetUsd ?? ''}
            />
          </Field>
          <Field id="limit-concurrent" label="Investigations running at once">
            <Input
              id="limit-concurrent"
              name="concurrent"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="No limit"
              disabled={!canEdit}
              defaultValue={limits.maxConcurrentInvestigations ?? ''}
            />
          </Field>
        </div>
        {error && <FormError>{error}</FormError>}
        {saved && (
          <p role="status" className="m-0 text-sm text-ok">
            Limits saved.
          </p>
        )}
        {canEdit && (
          <div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save limits'}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
