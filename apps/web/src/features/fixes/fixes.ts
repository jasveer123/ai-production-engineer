import type { PullRequestView } from '@ape/api-contracts';

export const PR_STATUSES = [
  'open',
  'merged',
  'closed',
] as const satisfies readonly PullRequestView['status'][];
export type PrFilter = PullRequestView['status'] | 'all';

export function parsePrFilter(value: string | null): PrFilter {
  return (PR_STATUSES as readonly string[]).includes(value ?? '') ? (value as PrFilter) : 'all';
}

export function filterPulls(pulls: PullRequestView[], filter: PrFilter): PullRequestView[] {
  return filter === 'all' ? pulls : pulls.filter((p) => p.status === filter);
}

export function countByStatus(pulls: PullRequestView[]): Record<PrFilter, number> {
  const counts = { all: pulls.length, open: 0, merged: 0, closed: 0 };
  for (const p of pulls) counts[p.status] += 1;
  return counts;
}
