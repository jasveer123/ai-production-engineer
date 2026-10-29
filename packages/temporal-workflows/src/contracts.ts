export const TASK_QUEUES = {
  incident: 'incident',

  evidence: 'evidence',

  ai: 'ai',

  sandbox: 'sandbox',
} as const;

export const TEST_PROMPT_VERSION = 'reproduce_v2';
export const PATCH_PROMPT_VERSION = 'patch_v2';

export const MAX_PATCH_ATTEMPTS = 3;

export const PROMPT_VERSION = 'investigate_v2';

export const incidentWorkflowId = (incidentId: string) => `incident-${incidentId}`;

export interface IncidentWorkflowInput {
  incidentId: string;
  workspaceId: string;
}

export interface StartInvestigationInput extends IncidentWorkflowInput {
  workflowId: string;

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

  reason: string | null;
  reportRef: string | null;
  model: string | null;
}

export interface Actor {
  actorId: string;
}

export interface EvidenceActivities {
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

export type PullRequestOutcome =
  | { status: 'created' | 'existing'; number: number; url: string }
  | { status: 'blocked'; reason: string };

export interface PrActivities {
  createPullRequest(
    input: IncidentWorkflowInput & { fixProposalId: string; approvalId: string },
  ): Promise<PullRequestOutcome>;
}

export interface PrStatusSignal {
  status: 'merged' | 'closed';
  mergeCommitSha: string | null;
  number: number;
}

export interface MonitoringPlan {
  deployWaitMs: number;

  deployPollMs: number;

  maxWindows: number;
}

export type FixDeployResult =
  | { status: 'found'; deploymentId: string; commitSha: string; deployedAt: string }
  | { status: 'not_yet' }
  | { status: 'superseded' };

export interface StartVerificationResult {
  verificationRunId: string;

  waitMs: number;

  checkEveryMs: number;
}

export type RecoveryOutcome = 'recovered' | 'not_recovered' | 'inconclusive';

export interface EvaluateVerificationResult {
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

  noFixDeploy(input: IncidentWorkflowInput & { waitedMs: number }): Promise<void>;
}
