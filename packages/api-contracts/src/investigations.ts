import { z } from 'zod';
import { HypothesisVerdict } from './quality-feedback-and-evaluation';

export type InvestigationStatus =
  'collecting_evidence' | 'analyzing' | 'completed' | 'needs_review' | 'failed' | 'cancelled';

export interface EvidenceRef {
  id: string;
  ref: string;
  kind: 'error_event' | 'alert' | 'trace' | 'log' | 'deploy' | 'code' | 'commit';
  title: string;
  sourceReference: string;
  sourceUrl: string | null;
}

export interface HypothesisView {
  id: string;
  rank: number;
  summary: string;
  confidence: 'high' | 'medium' | 'low' | null;
  confidenceRationale: string | null;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInformation: string[];
  suspectedLocation: { file: string; line: number | null; symbol: string | null } | null;
  /** Engineers' verdicts (Phase 9). `mine` is the caller's own verdict. */
  feedback: { correct: number; partly: number; wrong: number; mine: HypothesisVerdict | null };
}

export interface InvestigationView {
  id: string;
  attempt: number;
  status: InvestigationStatus;
  statusReason: string | null;
  model: string | null;
  promptVersion: string | null;
  coverage: Record<string, string | number>;
  observations: { statement: string; evidence: string[] }[];
  dataGaps: string[];
  rejectedCount: number;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
    latency_ms?: number;
    calls?: number;
  };
  requestNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  evidence: EvidenceRef[];
  hypotheses: HypothesisView[];
}

export interface IncidentInvestigation {
  /** Latest attempt first; null when no investigation has started yet. */
  latest: InvestigationView | null;
  attempts: number;
  workflow: { phase: string; attempt: number } | null;
  reproductionApproved: boolean;
}

export const INCIDENT_ACTIONS = ['investigate', 'approve_reproduction', 'dismiss'] as const;
export const incidentActionSchema = z.object({
  action: z.enum(INCIDENT_ACTIONS),
  note: z.string().trim().max(2000).optional(),
});
export type IncidentActionInput = z.infer<typeof incidentActionSchema>;
