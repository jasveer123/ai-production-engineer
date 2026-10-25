'use client';

import type { BusinessImpact } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export const businessKeys = {
  all: (ws: string) => ['ws', ws, 'business'] as const,
  impact: (ws: string, days: number) => [...businessKeys.all(ws), days] as const,
};

export function useBusinessImpact(days: number) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: businessKeys.impact(workspace.id, days),
    queryFn: () => api<BusinessImpact>(`/workspaces/${workspace.id}/business/impact?days=${days}`),
  });
}
