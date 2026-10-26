'use client';

import type {
  GitHubAppInfo,
  GitHubOverview,
  GitHubSelectView,
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

/** Installations, repositories and permissions, refreshed from GitHub; refetches on focus, so
 * coming back from GitHub after adding a repository shows it without a reload. */
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

/**
 * Sends the browser to a provider's approval page. The signed state is also kept for this tab,
 * because not every provider passes it back on the redirect.
 */
export async function startOAuth(
  workspaceId: string,
  provider: 'sentry' | 'vercel' | 'heroku',
): Promise<void> {
  const { url } = await api<OAuthStart>(`/workspaces/${workspaceId}/setup/oauth/${provider}/start`);
  const state = new URL(url).searchParams.get('state');
  try {
    if (state) sessionStorage.setItem(STATE_KEY(provider), state);
  } catch {
    // private mode: rely on the provider returning it
  }
  window.location.assign(url);
}

/**
 * Sends this tab to GitHub's install page. GitHub's App setup URL must be
 * /integrations/callback/github/ so we return here with installation_id and state.
 */
export async function startGitHubInstall(workspaceId: string, installUrl: string): Promise<void> {
  const { state } = await api<{ state: string }>(`/workspaces/${workspaceId}/setup/github/state`);
  try {
    sessionStorage.setItem(STATE_KEY('github'), state);
  } catch {
    // ignore
  }
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

/** The GitHub App's install state and links for this workspace. */
export function useGitHubApp() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'github-app'],
    queryFn: () => api<GitHubAppInfo>(`/workspaces/${workspace.id}/github/app`),
    refetchOnWindowFocus: true,
  });
}

/** Repositories each installation shares, with the ones already chosen. */
export function useGitHubSelect() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'github-select'],
    queryFn: () => api<GitHubSelectView>(`/workspaces/${workspace.id}/github/select`),
  });
}
