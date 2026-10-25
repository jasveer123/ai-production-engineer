'use client';

import type { EvidenceRef, HypothesisVerdict, HypothesisView } from '@ape/api-contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/card';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';
import { incidentKeys } from '../queries';

const CONFIDENCE_TONE = { high: 'ok', medium: 'warn', low: 'neutral' } as const;
const VERDICTS: { value: HypothesisVerdict; label: string }[] = [
  { value: 'correct', label: 'Correct' },
  { value: 'partly', label: 'Partly right' },
  { value: 'wrong', label: 'Wrong' },
];

export function HypothesisCard({
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: incidentKeys.detail(workspace.id, incidentId) }),
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

export function EvidenceLinks({ refs, evidence }: { refs: string[]; evidence: EvidenceRef[] }) {
  return (
    <span className="text-[13px] text-ink-muted">
      ({refs.map((r) => evidence.find((e) => e.ref === r)?.title ?? r).join('; ')})
    </span>
  );
}
