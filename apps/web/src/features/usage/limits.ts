export function budgetShare(costUsd: number, budgetUsd: number | null): number | null {
  if (budgetUsd === null) return null;
  if (budgetUsd === 0) return costUsd > 0 ? Infinity : 1;
  return costUsd / budgetUsd;
}
