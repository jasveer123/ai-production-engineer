import { z } from 'zod';

export const workspaceLimitsSchema = z.object({
  monthlyAiBudgetUsd: z.number().min(0).max(1_000_000).nullable(),
  maxConcurrentInvestigations: z.number().int().min(1).max(100).nullable(),
});
export type WorkspaceLimits = z.infer<typeof workspaceLimitsSchema>;

export interface UsageMonth {
  /** UTC month, `YYYY-MM`. */
  month: string;
  investigations: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxMinutes: number;
}

export interface UsageSummary {
  /** Last 6 UTC months, newest first. Months with no usage are included as zeros. */
  months: UsageMonth[];
  limits: WorkspaceLimits;
  runningInvestigations: number;
  /** Why a new investigation would be blocked right now, or null. */
  blockedReason: string | null;
}
