'use client';

import { useState } from 'react';
import type {
  EvidenceRef,
  HypothesisVerdict,
  IncidentInvestigation,
  InvestigationView,
} from '@ape/api-contracts';

type HypothesisView = InvestigationView['hypotheses'][number];
import { Badge, Button, Card, ErrorBox, Input, Loading } from '@/components/ui';
import {
  useEvidence,
  useHypothesisFeedback,
  useIncidentAction,
  useInvestigation,
} from '@/lib/queries';

const STATUS_TEXT: Record<InvestigationView['status'], string> = {
  collecting_evidence: 'Collecting evidence…',
  analyzing: 'Analyzing evidence…',
  completed: 'Report ready',
  needs_review: 'Needs review',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const REASONS: Record<string, string> = {
  no_model_configured:
    'No AI model is configured (set ANTHROPIC_API_KEY for the AI worker). Evidence was collected below.',
  no_supported_hypotheses: 'The evidence did not support any hypothesis. See the data gaps.',
  invalid_model_output: 'The model returned invalid output twice.',
  model_refused: 'The model declined this request.',
  evidence_too_large: 'The evidence bundle exceeded the input budget.',
};

function EvidenceChip({
  ev,
  onOpen,
}: {
  ev: EvidenceRef | undefined;
  onOpen: (id: string) => void;
}) {
  if (!ev) return <Badge tone="failure">missing</Badge>;
  return (
    <button
      onClick={() => onOpen(ev.id)}
      title={ev.title}
      className="rounded border border-line bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent"
    >
      {ev.ref}
    </button>
  );
}

function EvidencePanel({
  ws,
  incidentId,
  inv,
  open,
  onOpen,
}: {
  ws: string;
  incidentId: string;
  inv: InvestigationView;
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  const content = useEvidence(ws, incidentId, open);
  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold">Evidence ({inv.evidence.length})</p>
      <ul className="space-y-1 text-sm">
        {inv.evidence.map((e) => (
          <li key={e.id} className="flex items-baseline gap-2">
            <EvidenceChip ev={e} onOpen={(id) => onOpen(open === id ? null : id)} />
            <span className="text-xs text-subtle">{e.kind.replace('_', ' ')}</span>
            <span className="min-w-0 flex-1 truncate">{e.title}</span>
            {e.sourceUrl && (
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-accent hover:underline"
              >
                source ↗
              </a>
            )}
          </li>
        ))}
      </ul>
      {open && (
        <div className="mt-3 rounded-md border border-line bg-bg">
          {content.isPending ? (
            <Loading />
          ) : content.data ? (
            <>
              <p className="border-b border-line px-3 py-2 text-xs font-medium">
                {content.data.ref} · {content.data.title}
                <span className="ml-2 text-subtle">exactly what the AI saw (redacted)</span>
              </p>
              <pre className="max-h-96 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
                {content.data.content}
              </pre>
            </>
          ) : (
            <div className="p-3">
              <ErrorBox error={content.error} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const VERDICTS: { v: HypothesisVerdict; label: string }[] = [
  { v: 'correct', label: 'Correct' },
  { v: 'partly', label: 'Partly' },
  { v: 'wrong', label: 'Wrong' },
];

/** Was this the real cause? Engineers' verdicts feed the Quality page (Phase 9). */
function Verdict({
  ws,
  incidentId,
  h,
  canAct,
}: {
  ws: string;
  incidentId: string;
  h: HypothesisView;
  canAct: boolean;
}) {
  const vote = useHypothesisFeedback(ws, incidentId);
  const { correct, partly, wrong, mine } = h.feedback;
  const total = correct + partly + wrong;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs">
      <span className="text-subtle">Was this the cause?</span>
      {canAct ? (
        <div role="group" aria-label={`Verdict on hypothesis ${h.rank}`} className="flex gap-1">
          {VERDICTS.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              aria-pressed={mine === v}
              disabled={vote.isPending}
              onClick={() => vote.mutate({ hypothesisId: h.id, verdict: v })}
              className={`rounded border px-2 py-0.5 ${
                mine === v
                  ? 'border-accent bg-accent/15 font-medium text-accent'
                  : 'border-line text-subtle hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {total > 0 && (
        <span className="text-subtle">
          {correct} correct · {partly} partly · {wrong} wrong
        </span>
      )}
      {vote.error ? <ErrorBox error={vote.error} /> : null}
    </div>
  );
}

export function InvestigationReport({
  ws,
  incidentId,
  canAct,
}: {
  ws: string;
  incidentId: string;
  canAct: boolean;
}) {
  const q = useInvestigation(ws, incidentId);
  const action = useIncidentAction(ws, incidentId);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  if (q.isPending)
    return (
      <Card className="mb-6">
        <Loading label="Loading investigation…" />
      </Card>
    );
  if (q.error)
    return (
      <div className="mb-6">
        <ErrorBox error={q.error} />
      </div>
    );
  const data = q.data as IncidentInvestigation;
  const inv = data.latest;
  const phase = data.workflow?.phase;
  const running = phase === 'investigating';
  const awaiting = phase === 'awaiting_decision';
  const byRef = new Map(inv?.evidence.map((e) => [e.ref, e]) ?? []);
  const missing = Object.entries(inv?.coverage ?? {}).filter(
    ([k, v]) => typeof v === 'string' && v !== 'ok' && !['code_ref', 'code_tree'].includes(k),
  );
  const chips = (refs: string[]) => (
    <span className="inline-flex flex-wrap gap-1">
      {refs.map((r) => (
        <EvidenceChip key={r} ev={byRef.get(r)} onOpen={setOpen} />
      ))}
    </span>
  );
  const run = (a: 'investigate' | 'approve_reproduction' | 'dismiss') =>
    action.mutate({ action: a, note: note || undefined }, { onSuccess: () => setNote('') });

  return (
    <section className="mb-6 space-y-4" aria-label="AI investigation">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              AI investigation{inv ? ` #${inv.attempt}` : ''}{' '}
              {inv && <span className="font-normal text-subtle">· {STATUS_TEXT[inv.status]}</span>}
              {running && (
                <span
                  className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              {inv?.model ? `${inv.model} · ${inv.promptVersion} · ` : ''}
              {inv?.usage?.cost_usd !== undefined && inv.usage.calls
                ? `$${inv.usage.cost_usd.toFixed(4)} · `
                : ''}
              {data.workflow ? `workflow: ${phase?.replace('_', ' ')}` : 'not started yet'}
              {data.reproductionApproved && ' · reproduction approved'}
            </p>
          </div>
          {canAct && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-56"
                placeholder="Note for the AI or reason (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                variant="secondary"
                className="h-8"
                disabled={running || action.isPending}
                onClick={() => run('investigate')}
              >
                {inv ? 'Investigate further' : 'Investigate'}
              </Button>
              <Button
                className="h-8"
                disabled={!awaiting || inv?.status !== 'completed' || action.isPending}
                onClick={() => run('approve_reproduction')}
              >
                Approve reproduction
              </Button>
              <Button
                variant="danger"
                className="h-8"
                disabled={!awaiting || action.isPending}
                onClick={() => run('dismiss')}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
        <div className="mt-2">
          <ErrorBox error={action.error} />
        </div>
        {inv?.statusReason && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${inv.status === 'failed' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'}`}
          >
            {REASONS[inv.statusReason] ?? inv.statusReason}
          </p>
        )}
        {missing.length > 0 && (
          <p className="mt-3 text-xs text-warn">
            Data coverage:{' '}
            {missing
              .map(([k, v]) => `${k.replace('_', ' ')} ${String(v).replace('_', ' ')}`)
              .join(' · ')}
          </p>
        )}
      </Card>

      {inv && inv.hypotheses.length > 0 && (
        <Card className="p-4">
          <p className="mb-1 text-sm font-semibold">Hypotheses</p>
          <p className="mb-3 text-xs text-subtle">
            Ranked explanations. Not confirmed until a reproduction test proves one (Phase 5).
          </p>
          <ol className="space-y-4">
            {inv.hypotheses.map((h) => (
              <li key={h.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">#{h.rank}</span>
                  <Badge
                    tone={
                      h.confidence === 'high'
                        ? 'success'
                        : h.confidence === 'medium'
                          ? 'failure'
                          : undefined
                    }
                  >
                    {h.confidence ?? 'unknown'} confidence
                  </Badge>
                  <span className="rounded bg-info/15 px-1.5 py-0.5 font-medium text-info">
                    Hypothesis
                  </span>
                  {h.suspectedLocation && (
                    <code className="text-subtle">
                      {h.suspectedLocation.file}
                      {h.suspectedLocation.line ? `:${h.suspectedLocation.line}` : ''}
                      {h.suspectedLocation.symbol ? ` (${h.suspectedLocation.symbol})` : ''}
                    </code>
                  )}
                </div>
                <p className="mt-2 text-sm">{h.summary}</p>
                {h.confidenceRationale && (
                  <p className="mt-1 text-xs text-subtle">Why: {h.confidenceRationale}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
                  <span>Supported by {chips(h.supportingEvidence)}</span>
                  {h.contradictingEvidence.length > 0 && (
                    <span>Contradicted by {chips(h.contradictingEvidence)}</span>
                  )}
                </div>
                {h.missingInformation.length > 0 && (
                  <p className="mt-1 text-xs text-subtle">
                    Would confirm: {h.missingInformation.join('; ')}
                  </p>
                )}
                <Verdict ws={ws} incidentId={incidentId} h={h} canAct={canAct} />
              </li>
            ))}
          </ol>
        </Card>
      )}

      {inv && inv.observations.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Observations</p>
          <ul className="space-y-2 text-sm">
            {inv.observations.map((o, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-ok/15 px-1.5 py-0.5 text-[11px] font-medium text-ok">
                  Observed
                </span>
                <span className="min-w-0 flex-1">{o.statement}</span>
                {chips(o.evidence)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {inv && (inv.dataGaps.length > 0 || inv.rejectedCount > 0) && (
        <Card className="p-4 text-sm">
          {inv.dataGaps.length > 0 && (
            <>
              <p className="mb-1 font-semibold">Data gaps</p>
              <ul className="list-disc pl-5 text-subtle">
                {inv.dataGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </>
          )}
          {inv.rejectedCount > 0 && (
            <p className="mt-2 text-xs text-warn">
              {inv.rejectedCount} claim(s) were removed because they cited evidence that doesn’t
              exist.
            </p>
          )}
        </Card>
      )}

      {inv && inv.evidence.length > 0 && (
        <EvidencePanel ws={ws} incidentId={incidentId} inv={inv} open={open} onOpen={setOpen} />
      )}
    </section>
  );
}
