/** Share of the monthly AI budget used, 0..1+, or null when there is no budget. */
export function budgetShare(costUsd: number, budgetUsd: number | null): number | null {
  if (budgetUsd === null) return null;
  if (budgetUsd === 0) return costUsd > 0 ? Infinity : 1;
  return costUsd / budgetUsd;
}
