'use client';

import type {
  EvidenceRef,
  HypothesisVerdict,
  HypothesisView,
  IncidentActionInput,
  InvestigationView,
} from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession } from '@/features/auth/session';
import { api, errorMessage } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { incidentPrefix, useInvestigation } from '../queries';

const RUNNING = ['collecting_evidence', 'analyzing'];
const CONFIDENCE_TONE = { high: 'ok', medium: 'warn', low: 'neutral' } as const;
const VERDICTS: { value: HypothesisVerdict; label: string }[] = [
  { value: 'correct', label: 'Correct' },
  { value: 'partly', label: 'Partly right' },
  { value: 'wrong', label: 'Wrong' },
];

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
      qc.invalidateQueries({ queryKey: incidentPrefix(workspace.id, id) })
    ),
    onError: (e) => setError(errorMessage(e)),
  });
  const engineer = can('engineer');

  if (investigation.isPending) return <p className="text-ink-muted">Loading the report…</p>;
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
        <Hypothesis
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

function InvestigationStatus({ investigation }: { investigation: InvestigationView }) {
  const i = investigation;
  if (RUNNING.includes(i.status))
    return (
      <Banner tone="info" title="The AI is investigating.">
        {i.status === 'collecting_evidence' ? 'Collecting evidence.' : 'Analyzing the evidence.'}{' '}
        This page refreshes on its own.
      </Banner>
    );
  if (i.status === 'failed' || i.status === 'cancelled')
    return (
      <Banner
        tone="danger"
        title={`The investigation ${i.status === 'failed' ? 'failed' : 'was cancelled'}.`}
      >
        {i.statusReason ?? 'Start it again when ready.'}
      </Banner>
    );
  if (i.status === 'needs_review')
    return (
      <Banner tone="info" title="The AI is not sure. Review before acting.">
        {i.statusReason ?? 'The evidence was not strong enough for a confident answer.'}
      </Banner>
    );
  return (
    <Banner tone="ai" title="Written by the AI from the evidence below.">
      Every claim cites evidence; claims without it are removed automatically.
    </Banner>
  );
}

function Hypothesis({
  hypothesis: h,
  evidence,
  incidentId,
  canVote,
}: {
  hypothesis: HypothesisView;
  evidence: EvidenceRef[];
  incidentId: string;
  canVote: boolean;
}) {
  const { workspace } = useSession();
  const qc = useQueryClient();
  const vote = useMutation({
    mutationFn: (verdict: HypothesisVerdict) =>
      api(`/workspaces/${workspace.id}/incidents/${incidentId}/investigation/feedback`, {
        method: 'POST',
        json: { hypothesisId: h.id, verdict },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentPrefix(workspace.id, incidentId) }),
  });

  return (
    <Card as="article" className="grid gap-3">
      <CardHeader
        eyebrow={`Hypothesis ${h.rank}`}
        title={h.summary}
        aside={
          h.confidence && (
            <Badge tone={CONFIDENCE_TONE[h.confidence]}>{h.confidence} confidence</Badge>
          )
        }
      />
      {h.confidenceRationale && <p className="m-0 max-w-[72ch]">{h.confidenceRationale}</p>}
      {h.suspectedLocation && (
        <p className="m-0 text-[13px] text-ink-muted">
          Suspected code:{' '}
          <code className="font-mono text-ink">
            {h.suspectedLocation.file}
            {h.suspectedLocation.line ? `:${h.suspectedLocation.line}` : ''}
            {h.suspectedLocation.symbol ? ` (${h.suspectedLocation.symbol})` : ''}
          </code>
        </p>
      )}
      <EvidenceList title="Supporting evidence" refs={h.supportingEvidence} evidence={evidence} />
      <EvidenceList title="Against it" refs={h.contradictingEvidence} evidence={evidence} />
      {h.missingInformation.length > 0 && (
        <div>
          <Eyebrow>Would need</Eyebrow>
          <ul className="m-0 mt-1 grid gap-1 pl-5 text-[13px]">
            {h.missingInformation.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {canVote && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[13px] text-ink-muted">Was this right?</span>
          {VERDICTS.map((v) => (
            <Button
              key={v.value}
              size="sm"
              variant={h.feedback.mine === v.value ? 'primary' : 'secondary'}
              aria-pressed={h.feedback.mine === v.value}
              disabled={vote.isPending}
              onClick={() => vote.mutate(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

function EvidenceList({
  title,
  refs,
  evidence,
}: {
  title: string;
  refs: string[];
  evidence: EvidenceRef[];
}) {
  if (refs.length === 0) return null;
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="m-0 mt-2 grid list-none gap-2 p-0">
        {refs.map((ref) => {
          const e = evidence.find((x) => x.ref === ref);
          return (
            <li
              key={ref}
              className="rounded-sm border-l-[3px] border-spark bg-surface-sunken px-3 py-2 text-[13px] leading-5"
            >
              <span className="font-semibold">{e?.title ?? ref}</span>
              {e && <span className="text-ink-muted"> ({e.kind.replace('_', ' ')})</span>}
              {e?.sourceUrl && (
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-brand hover:underline"
                >
                  Open source
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EvidenceLinks({ refs, evidence }: { refs: string[]; evidence: EvidenceRef[] }) {
  return (
    <span className="text-[13px] text-ink-muted">
      ({refs.map((r) => evidence.find((e) => e.ref === r)?.title ?? r).join('; ')})
    </span>
  );
}
