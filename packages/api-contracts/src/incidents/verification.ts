import type { IsoTimestamp, Uuid } from '../common';

export const TRAFFIC_COUNT_CAP = 1000;

export interface VerificationRunView {
  id: Uuid;
  window: number;
  deployCommitSha: string;
  deployVersion: string | null;
  deployedAt: IsoTimestamp | null;
  status: 'observing' | 'completed';
  outcome: 'recovered' | 'not_recovered' | 'inconclusive' | null;
  reason: string | null;
  baseline: { errors: number; durationMs: number; errorsPerHour: number } | null;
  observed: {
    errors: number;
    durationMs: number;
    requests: number | null;
    operation: string | null;
    expectedErrors: number;
  } | null;
  windowStartedAt: IsoTimestamp | null;
  windowEndedAt: IsoTimestamp | null;
}

export interface IncidentVerification {
  runs: VerificationRunView[];
  awaitingDeploy: { prNumber: number | null; mergeCommitSha: string | null } | null;
  phase: string | null;
}
