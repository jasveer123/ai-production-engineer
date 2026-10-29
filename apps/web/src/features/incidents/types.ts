export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus =
  | 'investigating'
  | 'awaiting_approval'
  | 'fix_ready'
  | 'pr_open'
  | 'verifying'
  | 'resolved'
  | 'needs_attention';

export type HypothesisVerdict = 'correct' | 'partly' | 'wrong';

export type Hypothesis = {
  rank: number;
  title: string;
  explanation: string;
  confidence: number;
  evidence: string[];
  verdict?: HypothesisVerdict;
};

export type TimelineKind = 'detected' | 'deploy' | 'ai' | 'human' | 'test' | 'pr' | 'verify';

export type TimelineEvent = { at: string; kind: TimelineKind; text: string; actor: string };

export type FixAttempt = {
  attempt: number;
  testBefore: 'failed' | 'passed';
  testAfter: 'passed' | 'failed';
  suite: string;
};

export type Fix =
  | { state: 'none' }
  | {
      state: 'validated' | 'pr_open' | 'merged';
      testName: string;
      testFile: string;
      diff: string;
      attempts: FixAttempt[];
      prNumber?: number;
      prUrl?: string;
    };

export type Recovery =
  | { state: 'waiting'; note: string }
  | {
      state: 'recovered' | 'not_recovered' | 'inconclusive';
      errorsBefore: number;
      errorsAfter: number;
      windowMinutes: number;
      deployVersion: string;
    };

export type Incident = {
  id: string;
  title: string;
  service: string;
  environment: 'production' | 'staging';
  severity: Severity;
  status: IncidentStatus;
  openedAt: string;
  resolvedAt?: string;
  eventCount: number;
  affectedUsers: number;
  deploy: { version: string; commit: string; at: string } | null;
  summary: string;
  hypotheses: Hypothesis[];
  timeline: TimelineEvent[];
  fix: Fix;
  recovery: Recovery;
  aiCostUsd: number;

  flowId?: string;

  causedByChangeId?: string;
};
