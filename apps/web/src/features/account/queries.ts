'use client';

import type { AuditEvent } from '@ape/api-contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export const AUDIT_PAGE = 50;

/** Admins only (the API refuses others), so callers pass `enabled`. */
export function useAuditEvents(enabled: boolean) {
  const { workspace } = useSession();
  return useInfiniteQuery({
    queryKey: ['ws', workspace.id, 'audit'],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<AuditEvent[]>(
        `/workspaces/${workspace.id}/audit-events?limit=${AUDIT_PAGE}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) =>
      last.length === AUDIT_PAGE ? last[last.length - 1]!.occurredAt : undefined,
  });
}
