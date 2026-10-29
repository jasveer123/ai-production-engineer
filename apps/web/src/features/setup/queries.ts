'use client';

import type {
  GitHubOverview,
  OAuthStart,
  RepositoryAccess,
  SetupCapabilities,
} from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export function useSetupCapabilities() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'setup-capabilities'],
    queryFn: () => api<SetupCapabilities>(`/workspaces/${workspace.id}/setup/capabilities`),
    staleTime: 5 * 60_000,
  });
}

export function useGitHubOverview() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'github-overview'],
    queryFn: () => api<GitHubOverview>(`/workspaces/${workspace.id}/github/overview`),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useRepositories() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'repositories'],
    queryFn: () => api<RepositoryAccess[]>(`/workspaces/${workspace.id}/github/repository-access`),
  });
}

const STATE_KEY = (provider: string) => `ape.setup-state.${provider}`;

export async function startOAuth(
  workspaceId: string,
  provider: 'sentry' | 'vercel' | 'heroku',
): Promise<void> {
  const { url } = await api<OAuthStart>(`/workspaces/${workspaceId}/setup/oauth/${provider}/start`);
  const state = new URL(url).searchParams.get('state');
  try {
    if (state) sessionStorage.setItem(STATE_KEY(provider), state);
  } catch {}
  window.location.assign(url);
}

export async function startGitHubInstall(workspaceId: string, installUrl: string): Promise<void> {
  const { state } = await api<{ state: string }>(`/workspaces/${workspaceId}/setup/github/state`);
  try {
    sessionStorage.setItem(STATE_KEY('github'), state);
  } catch {}
  const u = new URL(installUrl);
  u.searchParams.set('state', state);
  window.location.assign(u.toString());
}

export function takeStoredState(provider: string): string | null {
  try {
    const v = sessionStorage.getItem(STATE_KEY(provider));
    sessionStorage.removeItem(STATE_KEY(provider));
    return v;
  } catch {
    return null;
  }
}
