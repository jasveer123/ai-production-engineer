'use client';

import type { DiscoveredService, Service } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export function useServices() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'services'],
    queryFn: () => api<Service[]>(`/workspaces/${workspace.id}/services`),
  });
}

export function useDiscoveredServices() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'services', 'discovered'],
    queryFn: () => api<DiscoveredService[]>(`/workspaces/${workspace.id}/services/discovered`),
  });
}
