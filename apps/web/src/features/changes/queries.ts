'use client';

import type { RepoCommit } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export function useCommits(serviceId: string) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'services', serviceId, 'commits'],
    queryFn: () =>
      api<RepoCommit[]>(`/workspaces/${workspace.id}/services/${serviceId}/commits?limit=20`),
    enabled: serviceId !== '',

    retry: false,
  });
}
