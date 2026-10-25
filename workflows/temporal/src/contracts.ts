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
  /** Isolated test runs (sandbox-manager: Docker + object storage only, no DB or GitHub). */
  sandbox: 'sandbox',
} as const;

export const TEST_PROMPT_VERSION = 'reproduce_v2';
export const PATCH_PROMPT_VERSION = 'patch_v2';
/** Patch attempts per fix version before giving up (Phase 5: bounded retries). */
export const MAX_PATCH_ATTEMPTS = 3;

export const PROMPT_VERSION = 'investigate_v2';

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
  /** `blocked` is set when the workspace usage limits stopped the start (FR-16). */
  startInvestigation(
    input: StartInvestigationInput,
  ): Promise<{ investigationId: string; blocked?: string }>;
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
  | 'investigating'
  | 'awaiting_decision'
  | 'reproduction_approved'
  | 'reproducing'
  | 'patching'
  | 'validating'
  | 'awaiting_fix_decision'
  | 'pr_approved'
  | 'pr_open'
  | 'pr_merged'
  | 'awaiting_deploy'
  | 'verifying'
  | 'resolved'
  | 'not_recovered'
  | 'verification_inconclusive'
  | 'fix_rejected'
  | 'dismissed'
  | 'cancelled';

// ----- Phase 5: reproduce, fix, validate -----

export interface SandboxProfile {
  runtime: 'node22-pnpm';
  packageDir: string;
  testCommand: string;
  testDir: string;
}

export interface TestSummary {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  files: { file: string; tests: number; failures: number }[];
}

export interface SandboxRunResult {
  status: 'passed' | 'failed' | 'error';
  reason: string | null;
  exitCode: number | null;
  durationMs: number;
  summary: TestSummary;
  outputRef: string;
}

export interface SandboxActivities {
  prepareImage(input: { sourceRef: string; profile: SandboxProfile }): Promise<{ image: string }>;
  runSuite(input: {
    sourceRef: string;
    image: string;
    profile: SandboxProfile;
    overlayRef: string | null;
    only: string[] | null;
    label: string;
  }): Promise<SandboxRunResult>;
}

export type PrepareFixResult =
  | {
      ok: true;
      fixProposalId: string;
      sourceRef: string;
      contextRef: string;
      profile: SandboxProfile;
      /** Repo-relative path for the generated regression test. */
      testPath: string;
    }
  | { ok: false; fixProposalId: string | null; reason: string };

export interface ApplyPatchResult {
  ok: boolean;
  overlayRef: string | null;
  violations: string[];
  diffStat: { files: number; additions: number; deletions: number } | null;
}

export type FixStatus =
  | 'preparing'
  | 'baseline_failed'
  | 'reproducing'
  | 'not_reproduced'
  | 'patching'
  | 'validating'
  | 'validated'
  | 'validation_failed'
  | 'rejected'
  | 'error';

export type RunKind = 'baseline' | 'reproduction' | 'regression' | 'full_suite' | 'policy';

export interface FixActivities {
  prepareFix(
    input: IncidentWorkflowInput & { runKey: string; version: number },
  ): Promise<PrepareFixResult>;
  recordRun(input: {
    fixProposalId: string;
    kind: RunKind;
    attempt: number;
    image: string;
    result: {
      status: 'passed' | 'failed' | 'error' | 'skipped';
      reason: string | null;
      exitCode?: number | null;
      durationMs?: number;
      summary: Record<string, unknown> | TestSummary;
      outputRef?: string | null;
    };
  }): Promise<void>;
  applyPatch(input: {
    fixProposalId: string;
    attempt: number;
    patchRef: string;
    testRef: string;
  }): Promise<ApplyPatchResult>;
  updateFix(input: {
    fixProposalId: string;
    status: FixStatus;
    reason?: string | null;
    testRef?: string;
    testRationale?: string;
    explanation?: string;
    patchAttempts?: number;
  }): Promise<void>;
  setIncidentStatus(input: IncidentWorkflowInput & { to: string; summary: string }): Promise<void>;
  /** Overlay containing only the regression test (for the reproduction run). */
  testOverlay(input: { fixProposalId: string; testRef: string }): Promise<{ overlayRef: string }>;
}

export interface GenerateTestResult {
  status: 'ok' | 'failed';
  reason: string | null;
  testRef: string | null;
  rationale: string | null;
}

export interface GeneratePatchResult {
  status: 'ok' | 'failed';
  reason: string | null;
  patchRef: string | null;
  explanation: string | null;
}

export interface FixAiActivities {
  generateTest(input: {
    fixProposalId: string;
    workspaceId: string;
    contextRef: string;
    testPath: string;
    promptVersion: string;
  }): Promise<GenerateTestResult>;
  generatePatch(input: {
    fixProposalId: string;
    workspaceId: string;
    contextRef: string;
    testRef: string;
    failureRef: string;
    attempt: number;
    feedback: string | null;
    promptVersion: string;
  }): Promise<GeneratePatchResult>;
}

export interface WorkflowState {
  phase: WorkflowPhase;
  attempt: number;
}

// ----- Phase 6: approval and pull request -----

export type PullRequestOutcome =
  | { status: 'created' | 'existing'; number: number; url: string }
  | { status: 'blocked'; reason: string };

export interface PrActivities {
  /**
   * Opens the pull request for an approved, validated fix. Idempotent: a retry after a lost
   * response finds the existing branch and PR. Re-checks the approver's role, the GitHub
   * installation's write access and the approved patch hash before writing anything.
   */
  createPullRequest(
    input: IncidentWorkflowInput & { fixProposalId: string; approvalId: string },
  ): Promise<PullRequestOutcome>;
}

export interface PrStatusSignal {
  status: 'merged' | 'closed';
  mergeCommitSha: string | null;
  number: number;
}

// ----- Phase 7: recovery verification -----

/** Timing comes from API config through an activity, so the workflow stays deterministic. */
export interface MonitoringPlan {
  /** Give up waiting for a deploy that contains the fix after this long. */
  deployWaitMs: number;
  /** Re-check for the deploy at least this often (a deploy signal wakes the workflow sooner). */
  deployPollMs: number;
  /** Inconclusive windows are extended (cumulatively) up to this many times. */
  maxWindows: number;
}

export type FixDeployResult =
  | { status: 'found'; deploymentId: string; commitSha: string; deployedAt: string }
  | { status: 'not_yet' }
  /** The incident left monitoring (e.g. a human resolved it), so verification stops. */
  | { status: 'superseded' };

export interface StartVerificationResult {
  verificationRunId: string;
  /** Until the observation window (plus ingestion settle time) has ended. */
  waitMs: number;
  /** Interim checks catch a fix that did not work before the window ends. */
  checkEveryMs: number;
}

export type RecoveryOutcome = 'recovered' | 'not_recovered' | 'inconclusive';

export interface EvaluateVerificationResult {
  /** `pending` only for interim checks that found nothing conclusive yet. */
  outcome: RecoveryOutcome | 'pending';
  reason: string;
  superseded: boolean;
}

export interface VerifyActivities {
  beginMonitoring(
    input: IncidentWorkflowInput & { mergeCommitSha: string | null; prNumber: number },
  ): Promise<MonitoringPlan>;
  findFixDeploy(
    input: IncidentWorkflowInput & { mergeCommitSha: string | null },
  ): Promise<FixDeployResult>;
  startVerification(
    input: IncidentWorkflowInput & { deploymentId: string; window: number },
  ): Promise<StartVerificationResult>;
  evaluateVerification(input: {
    verificationRunId: string;
    interim: boolean;
    finalWindow: boolean;
  }): Promise<EvaluateVerificationResult>;
  /** No deploy with the fix arrived in time: the incident becomes verification_inconclusive. */
  noFixDeploy(input: IncidentWorkflowInput & { waitedMs: number }): Promise<void>;
}
