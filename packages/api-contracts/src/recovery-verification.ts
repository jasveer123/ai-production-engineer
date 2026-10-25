import { z } from 'zod';

/** Traffic counts stop at this many traces: enough to decide, cheap to query. */
export const TRAFFIC_COUNT_CAP = 1000;

export interface VerificationRunView {
  id: string;
  window: number;
  deployCommitSha: string;
  deployVersion: string | null;
  deployedAt: string | null;
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
  windowStartedAt: string | null;
  windowEndedAt: string | null;
}

export interface IncidentVerification {
  /** Latest window first. */
  runs: VerificationRunView[];
  /** The merged fix the platform is waiting to see deployed, if any. */
  awaitingDeploy: { prNumber: number | null; mergeCommitSha: string | null } | null;
  phase: string | null;
}

export const FIX_ACTIONS = ['regenerate', 'reject', 'approve_pr'] as const;
export const fixActionSchema = z.object({
  action: z.enum(FIX_ACTIONS),
  note: z.string().trim().max(2000).optional(),
});
export type FixActionInput = z.infer<typeof fixActionSchema>;
