import { z } from 'zod';

export const workspaceLimitsSchema = z.object({
  monthlyAiBudgetUsd: z.number().min(0).max(1_000_000).nullable(),
  maxConcurrentInvestigations: z.number().int().min(1).max(100).nullable(),
});
export type WorkspaceLimits = z.infer<typeof workspaceLimitsSchema>;

export interface UsageMonth {
  month: string;
  investigations: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxMinutes: number;
}

export interface UsageSummary {
  months: UsageMonth[];
  limits: WorkspaceLimits;
  runningInvestigations: number;
  blockedReason: string | null;
}
