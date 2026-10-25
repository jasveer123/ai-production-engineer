'use client';

import type { PullRequestView } from '@ape/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/features/auth/session';
import { incidentPrefix } from '@/features/incidents/queries';
import { api } from '@/lib/api';

const key = (ws: string) => ['ws', ws, 'pull-requests'];

/** Every fix pull request in the workspace, newest first (the API returns at most 200). */
export function usePullRequests() {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: key(ws),
    queryFn: () => api<PullRequestView[]>(`/workspaces/${ws}/pull-requests`),
    refetchInterval: 60_000,
  });
}

/** "Sync now": re-reads one PR's status and checks from GitHub. */
export function useSyncPullRequest() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PullRequestView>(`/workspaces/${ws}/pull-requests/${id}/sync`, { method: 'POST' }),
    onSuccess: (fresh) => {
      qc.setQueryData<PullRequestView[]>(key(ws), (old) =>
        old?.map((p) => (p.id === fresh.id ? fresh : p)),
      );
      if (fresh.incidentId)
        void qc.invalidateQueries({ queryKey: incidentPrefix(ws, fresh.incidentId) });
    },
  });
}
