'use client';

import type { UsageSummary } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export const usageKeys = { all: (ws: string) => ['ws', ws, 'usage'] as const };

/** Admins only (the API refuses others), so callers pass `enabled`. */
export function useUsage(enabled: boolean) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: usageKeys.all(workspace.id),
    queryFn: () => api<UsageSummary>(`/workspaces/${workspace.id}/usage`),
    enabled,
  });
}
