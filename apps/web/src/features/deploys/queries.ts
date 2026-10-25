'use client';

import type { Deployment, DeploymentDetail } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

/** Deploy markers, newest first, optionally for one service and environment. */
export function useDeployments(filter: { service?: string; environment?: string; limit?: number }) {
  const { workspace } = useSession();
  const q = new URLSearchParams({ limit: String(filter.limit ?? 100) });
  if (filter.service) q.set('service', filter.service);
  if (filter.environment) q.set('environment', filter.environment);
  return useQuery({
    queryKey: ['ws', workspace.id, 'deployments', q.toString()],
    queryFn: () => api<Deployment[]>(`/workspaces/${workspace.id}/deployments?${q}`),
  });
}

export function useDeployment(id: string) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'deployments', 'detail', id],
    queryFn: () => api<DeploymentDetail>(`/workspaces/${workspace.id}/deployments/${id}`),
  });
}
