'use client';

import type { LogSearchResult } from '@ape/api-contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/features/auth';
import { api } from '@/lib/api';

export const logKeys = {
  search: (ws: string, q: string, range: string, to: number) =>
    ['ws', ws, 'logs', q, range, to] as const,
};

type LogSearchParams = { q: string; range: string; rangeMs: number; to: number };

/** One window of log lines ending at `to`, older pages on demand. */
export function useLogSearch({ q, range, rangeMs, to }: LogSearchParams) {
  const ws = useWorkspaceId();
  return useInfiniteQuery({
    queryKey: logKeys.search(ws, q, range, to),
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams({
        q,
        from: new Date(to - rangeMs).toISOString(),
        to: new Date(to).toISOString(),
        limit: '200',
      });
      if (pageParam) sp.set('before', String(pageParam));
      return api<LogSearchResult>(`/workspaces/${ws}/logs?${sp}`);
    },
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    placeholderData: (prev) => prev,
  });
}
