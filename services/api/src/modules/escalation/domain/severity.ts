const RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function meetsSeverity(severity: string, minimum: string): boolean {
  return (RANK[severity] ?? 0) >= (RANK[minimum] ?? 0);
}
