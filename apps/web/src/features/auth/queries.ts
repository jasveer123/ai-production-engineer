'use client';

import type { InvitationPreview, Me } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const authKeys = {
  providers: ['auth', 'providers'] as const,
  invite: (token: string) => ['invite', token] as const,
};

export function useAuthProviders() {
  return useQuery({
    queryKey: authKeys.providers,
    queryFn: () => api<Me['authProviders']>('/auth/providers'),
    staleTime: Infinity,
  });
}

export function useInvitePreview(token: string | null) {
  return useQuery({
    queryKey: authKeys.invite(token ?? ''),
    queryFn: () => api<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token!)}`),
    enabled: Boolean(token),
    retry: false,
  });
}
