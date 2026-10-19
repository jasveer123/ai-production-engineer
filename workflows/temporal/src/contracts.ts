/**
 * Activity contracts shared by the TypeScript workers and the Python AI worker.
 * Keep in sync with services/ai-worker/src/ai_worker/contracts.py (ADR-015).
 * Only IDs and object-storage references cross workflow history, never raw logs or code.
 */

export const TASK_QUEUES = {
  /** Workflow tasks. */
  incident: 'incident',
  /** Evidence collection and persistence (TypeScript, has DB/GitHub/Jaeger access). */
  evidence: 'evidence',
  /** Model calls (Python AI worker). */
  ai: 'ai',
} as const;

export const PROMPT_VERSION = 'investigate_v1';

export const incidentWorkflowId = (incidentId: string) => `incident-${incidentId}`;

export interface IncidentWorkflowInput {
  incidentId: string;
  workspaceId: string;
}

export interface StartInvestigationInput extends IncidentWorkflowInput {
  workflowId: string;
  /** With the run id, makes the investigation row idempotent across activity retries. */
  runId: string;
  attempt: number;
  note: string | null;
}

export interface CollectEvidenceResult {
  bundleRef: string;
  evidenceCount: number;
}

export interface InvestigateInput {
  investigationId: string;
  workspaceId: string;
  bundleRef: string;
  promptVersion: string;
}

export interface InvestigateResult {
  status: 'completed' | 'needs_review';
  /** Why the result needs review, e.g. "no_model_configured" or "no_supported_hypotheses". */
  reason: string | null;
  reportRef: string | null;
  model: string | null;
}

export interface Actor {
  actorId: string;
}

export interface EvidenceActivities {
  startInvestigation(input: StartInvestigationInput): Promise<{ investigationId: string }>;
  collectEvidence(input: { investigationId: string }): Promise<CollectEvidenceResult>;
  publishReport(input: { investigationId: string; result: InvestigateResult }): Promise<void>;
  markInvestigation(input: {
    investigationId: string;
    status: 'failed' | 'cancelled';
    reason: string;
  }): Promise<void>;
  closeIncident(input: IncidentWorkflowInput & Actor & { reason: string }): Promise<void>;
  recordReproductionApproval(input: IncidentWorkflowInput & Actor): Promise<void>;
}

export interface AiActivities {
  investigate(input: InvestigateInput): Promise<InvestigateResult>;
}

export type WorkflowPhase =
  'investigating' | 'awaiting_decision' | 'reproduction_approved' | 'dismissed' | 'cancelled';

export interface WorkflowState {
  phase: WorkflowPhase;
  attempt: number;
}
