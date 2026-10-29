'use client';

import type { Invitation, Member } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { api } from '@/lib/api';

export const memberKeys = {
  all: (ws: string) => ['ws', ws, 'members'] as const,
  invitations: (ws: string) => ['ws', ws, 'invitations'] as const,
};

export function useMembers() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: memberKeys.all(workspace.id),
    queryFn: () => api<Member[]>(`/workspaces/${workspace.id}/members`),
  });
}

export function useInvitations(enabled: boolean) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: memberKeys.invitations(workspace.id),
    queryFn: () => api<Invitation[]>(`/workspaces/${workspace.id}/invitations`),
    enabled,
  });
}
