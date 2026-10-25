'use client';

import type { RepoCommit } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

/** The latest 20 commits on the service's default branch, read from GitHub by the API. */
export function useCommits(serviceId: string) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'services', serviceId, 'commits'],
    queryFn: () =>
      api<RepoCommit[]>(`/workspaces/${workspace.id}/services/${serviceId}/commits?limit=20`),
    enabled: serviceId !== '',
    // A 409 (no repository, or GitHub cannot read it) will not fix itself on retry.
    retry: false,
  });
}
