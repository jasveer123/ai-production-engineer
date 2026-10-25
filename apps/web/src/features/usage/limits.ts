import type { WorkspaceLimits } from '@ape/api-contracts';

/** Share of the monthly AI budget used, 0..1+, or null when there is no budget. */
export function budgetShare(costUsd: number, budgetUsd: number | null): number | null {
  if (budgetUsd === null) return null;
  if (budgetUsd === 0) return costUsd > 0 ? Infinity : 1;
  return costUsd / budgetUsd;
}

/** Form fields → limits. Empty means no limit; anything else must be a valid number. */
export function parseLimits(budget: string, concurrent: string): WorkspaceLimits | string {
  const b = budget.trim();
  const c = concurrent.trim();
  const monthlyAiBudgetUsd = b === '' ? null : Number(b);
  const maxConcurrentInvestigations = c === '' ? null : Number(c);
  if (
    monthlyAiBudgetUsd !== null &&
    !(Number.isFinite(monthlyAiBudgetUsd) && monthlyAiBudgetUsd >= 0)
  ) {
    return 'Enter a budget of 0 or more, or leave it empty for no budget.';
  }
  if (
    maxConcurrentInvestigations !== null &&
    !(Number.isInteger(maxConcurrentInvestigations) && maxConcurrentInvestigations >= 1)
  ) {
    return 'Enter a whole number of 1 or more, or leave it empty for no limit.';
  }
  return { monthlyAiBudgetUsd, maxConcurrentInvestigations };
}
