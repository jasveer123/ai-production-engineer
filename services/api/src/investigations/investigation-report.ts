import type { InvestigateResult } from '@ape/temporal-workflows';
import type { incidents, investigations, services } from '../db/schema';
import type { CollectedEvidence } from './evidence-format';

/** Report written by the Python AI worker (see services/ai-worker/src/ai_worker/report.py). */
export interface StoredReport {
  status: 'completed' | 'needs_review';
  reason: string | null;
  model: string | null;
  prompt_version: string;
  observations: { statement: string; evidence: string[] }[];
  hypotheses: {
    rank: number;
    summary: string;
    confidence: 'high' | 'medium' | 'low';
    confidence_rationale: string;
    supporting_evidence: string[];
    contradicting_evidence: string[];
    missing_information: string[];
    suspected_location: { file: string; line: number | null; symbol: string | null } | null;
  }[];
  data_gaps: string[];
  rejected: { kind: string; text: string; reason: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    latency_ms: number;
    calls: number;
  };
}

export const CONFIDENCE = { high: '0.80', medium: '0.50', low: '0.20' } as const;

/**
 * Defense in depth: re-checks every citation of the worker's report against this investigation's
 * evidence rows and keeps only what is fully supported.
 */
export function acceptCitations(report: StoredReport | null, byRef: Map<string, string>) {
  const valid = (refs: string[]) => refs.length > 0 && refs.every((r) => byRef.has(r));
  const hyps = (report?.hypotheses ?? []).filter(
    (h) => valid(h.supporting_evidence) && h.contradicting_evidence.every((r) => byRef.has(r)),
  );
  const observations = (report?.observations ?? []).filter((o) => valid(o.evidence));
  return { hyps, observations };
}

/** `completed` only when the worker finished and at least one hypothesis is fully cited. */
export function reportOutcome(
  result: Pick<InvestigateResult, 'status' | 'reason'>,
  hypothesisCount: number,
): { status: 'completed' | 'needs_review'; reason: string | null } {
  const status =
    result.status === 'completed' && hypothesisCount > 0 ? 'completed' : 'needs_review';
  return {
    status,
    reason: status === 'completed' ? null : (result.reason ?? 'no_supported_hypotheses'),
  };
}

/** Billable usage of one model run: tokens, cost and the investigation itself. */
export function modelUsageRows(workspaceId: string, usage: StoredReport['usage']) {
  return [
    { workspaceId, metric: 'model_input_tokens', quantity: String(usage.input_tokens) },
    { workspaceId, metric: 'model_output_tokens', quantity: String(usage.output_tokens) },
    { workspaceId, metric: 'model_cost_usd', quantity: String(usage.cost_usd) },
    { workspaceId, metric: 'investigations', quantity: '1' },
  ];
}

interface BundleParts {
  investigationId: string;
  incident: typeof incidents.$inferSelect;
  service: typeof services.$inferSelect | undefined;
  note: typeof investigations.$inferSelect.requestNote;
  collected: CollectedEvidence;
  rows: { ref: string; id: string; kind: string; title: string; sourceUrl: string | null }[];
}

/** The evidence bundle the AI worker reads from object storage. */
export function evidenceBundle(parts: BundleParts) {
  const { incident, service, collected, rows } = parts;
  return {
    version: 1,
    investigationId: parts.investigationId,
    incident: {
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      serviceName: incident.serviceName,
      environment: incident.environment,
      repositoryFullName: service?.repositoryFullName ?? null,
      firstSeenAt: incident.firstSeenAt.toISOString(),
      lastSeenAt: incident.lastSeenAt.toISOString(),
      eventCount: incident.eventCount,
    },
    note: parts.note,
    coverage: collected.coverage,
    items: rows.map((r, i) => ({
      ref: r.ref,
      id: r.id,
      kind: r.kind,
      title: r.title,
      source: collected.items[i]!.source,
      sourceUrl: r.sourceUrl,
      content: collected.items[i]!.content,
    })),
  };
}
