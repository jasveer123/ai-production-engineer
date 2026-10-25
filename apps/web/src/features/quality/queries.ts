'use client';

import type { QualitySummary } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/features/auth/session';
import { api } from '@/lib/api';

export function useQuality(days: number) {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: ['ws', ws, 'quality', days],
    queryFn: () => api<QualitySummary>(`/workspaces/${ws}/quality?days=${days}`),
  });
}
