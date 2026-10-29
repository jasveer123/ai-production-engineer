'use client';

import type { IncidentActionInput } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { incidentKeys, useInvestigation } from '../queries';
import { EvidenceLinks, HypothesisCard } from './hypothesis-card';
import { InvestigationStatus, RUNNING } from './investigation-status';

export function IncidentReport({ id }: { id: string }) {
  const { workspace, can } = useSession();
  const qc = useQueryClient();
  const investigation = useInvestigation(id);
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (body: IncidentActionInput) =>
      api(`/workspaces/${workspace.id}/incidents/${id}/actions`, { method: 'POST', json: body }),
    onSuccess: () => (
      setError(null),
      qc.invalidateQueries({ queryKey: incidentKeys.detail(workspace.id, id) })
    ),
    onError: (e) => setError(errorMessage(e)),
  });
  const engineer = can('engineer');

  if (investigation.isPending) return <ListSkeleton label="Loading the report" />;
  if (investigation.isError)
    return (
      <Banner tone="danger" title="Could not load the report.">
        {errorMessage(investigation.error)}
      </Banner>
    );
  const { latest, workflow, reproductionApproved } = investigation.data;
  const errorBanner = error && (
    <Banner tone="danger" title="That did not work.">
      {error}
    </Banner>
  );

  if (!latest)
    return (
      <div className="grid gap-4">
        {errorBanner}
        <EmptyState
          icon="spark"
          title={workflow ? 'Investigation starting' : 'No investigation yet'}
          action={
            engineer && !workflow ? (
              <Button
                onClick={() => act.mutate({ action: 'investigate' })}
                disabled={act.isPending}
              >
                Start investigation
              </Button>
            ) : undefined
          }
        >
          {workflow
            ? 'The AI is collecting evidence. This page refreshes on its own.'
            : 'The AI reads the evidence for this incident and writes a report with ranked causes.'}
        </EmptyState>
      </div>
    );

  const running = RUNNING.includes(latest.status);
  return (
    <div className="grid gap-6">
      {errorBanner}
      <InvestigationStatus investigation={latest} />

      {latest.observations.length > 0 && (
        <Card as="section" className="grid gap-3">
          <CardHeader eyebrow="Observed" title="What the evidence shows" />
          <ul className="m-0 grid gap-2 pl-5">
            {latest.observations.map((o) => (
              <li key={o.statement}>
                {o.statement} <EvidenceLinks refs={o.evidence} evidence={latest.evidence} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {latest.dataGaps.length > 0 && (
        <Banner tone="info" title="Missing data. The AI did not guess these:">
          <ul className="m-0 mt-1 grid gap-1 pl-5">
            {latest.dataGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Banner>
      )}

      {latest.hypotheses.map((h) => (
        <HypothesisCard
          key={h.id}
          hypothesis={h}
          evidence={latest.evidence}
          incidentId={id}
          canVote={engineer}
        />
      ))}

      {engineer && !running && (
        <Card as="section" className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 max-w-[60ch] text-ink-muted">
            {reproductionApproved
              ? 'Reproduction is approved. The AI writes a failing test and a fix in the locked sandbox.'
              : 'Next, the AI can reproduce the bug in a locked sandbox and write a fix. Nothing touches your repository until you approve the pull request.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={act.isPending}
              onClick={() => act.mutate({ action: 'investigate' })}
            >
              Investigate again
            </Button>
            {!reproductionApproved && latest.hypotheses.length > 0 && (
              <Button
                disabled={act.isPending}
                onClick={() => act.mutate({ action: 'approve_reproduction' })}
              >
                Approve reproduction
              </Button>
            )}
          </div>
        </Card>
      )}

      <p className="text-[13px] text-ink-muted">
        Attempt {latest.attempt}
        {latest.model ? `, model ${latest.model}` : ''}
        {latest.usage.cost_usd !== undefined ? `, AI cost ${formatUsd(latest.usage.cost_usd)}` : ''}
        {latest.rejectedCount > 0
          ? `. ${latest.rejectedCount} claim${latest.rejectedCount === 1 ? '' : 's'} without evidence removed.`
          : '.'}
      </p>
    </div>
  );
}
