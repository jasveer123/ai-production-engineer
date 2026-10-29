import { z } from 'zod';
import { optionalText, type Uuid, type IsoTimestamp } from '../common';
import type { HypothesisVerdict } from './quality';

export type InvestigationStatus =
  'collecting_evidence' | 'analyzing' | 'completed' | 'needs_review' | 'failed' | 'cancelled';

export type Confidence = 'high' | 'medium' | 'low';

export interface EvidenceRef {
  id: Uuid;
  ref: string;
  kind: 'error_event' | 'alert' | 'trace' | 'log' | 'deploy' | 'code' | 'commit';
  title: string;
  sourceReference: string;
  sourceUrl: string | null;
}

export interface HypothesisView {
  id: Uuid;
  rank: number;
  summary: string;
  confidence: Confidence | null;
  confidenceRationale: string | null;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInformation: string[];
  suspectedLocation: { file: string; line: number | null; symbol: string | null } | null;
  feedback: Record<HypothesisVerdict, number> & { mine: HypothesisVerdict | null };
}

export interface InvestigationUsage {
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  calls?: number;
}

export interface InvestigationView {
  id: Uuid;
  attempt: number;
  status: InvestigationStatus;
  statusReason: string | null;
  model: string | null;
  promptVersion: string | null;
  coverage: Record<string, string | number>;
  observations: { statement: string; evidence: string[] }[];
  dataGaps: string[];
  rejectedCount: number;
  usage: InvestigationUsage;
  requestNote: string | null;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  evidence: EvidenceRef[];
  hypotheses: HypothesisView[];
}

export interface IncidentInvestigation {
  latest: InvestigationView | null;
  attempts: number;
  workflow: { phase: string; attempt: number } | null;
  reproductionApproved: boolean;
}

export const INCIDENT_ACTIONS = ['investigate', 'approve_reproduction', 'dismiss'] as const;
export const incidentActionSchema = z.object({
  action: z.enum(INCIDENT_ACTIONS),
  note: optionalText(2000),
});
export type IncidentActionInput = z.infer<typeof incidentActionSchema>;
