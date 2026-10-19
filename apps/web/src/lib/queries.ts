'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditEvent,
  AuditQuery,
  CreateServiceInput,
  Invitation,
  InviteMemberInput,
  Me,
  Member,
  PullRequestView,
  Role,
  Service,
  UpdateServiceInput,
  Workspace,
} from '@ape/api-contracts';
import type {
  CreateIncidentInput,
  CreateIntegrationInput,
  DeadLetter,
  FixActionInput,
  GitHubAppInfo,
  IncidentFixes,
  Incident,
  IncidentActionInput,
  IncidentInvestigation,
  IncidentListQuery,
  IncidentVerification,
  Integration,
  IntegrationWithSecret,
  RepoCommit,
  RepositoryAccess,
  TimelineEntry,
  TransitionIncidentInput,
} from '@ape/api-contracts';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  providers: ['providers'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  services: (id: string) => ['workspace', id, 'services'] as const,
  members: (id: string) => ['workspace', id, 'members'] as const,
  invitations: (id: string) => ['workspace', id, 'invitations'] as const,
  audit: (id: string, q: AuditQuery) => ['workspace', id, 'audit', q] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/auth/me') });

export const useProviders = () =>
  useQuery({
    queryKey: keys.providers,
    queryFn: () => api<Me['authProviders']>('/auth/providers'),
  });

export const useWorkspace = (id: string) =>
  useQuery({ queryKey: keys.workspace(id), queryFn: () => api<Workspace>(`/workspaces/${id}`) });

export const useServices = (ws: string) =>
  useQuery({
    queryKey: keys.services(ws),
    queryFn: () => api<Service[]>(`/workspaces/${ws}/services`),
  });

export const useMembers = (ws: string) =>
  useQuery({
    queryKey: keys.members(ws),
    queryFn: () => api<Member[]>(`/workspaces/${ws}/members`),
  });

export const useInvitations = (ws: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.invitations(ws),
    queryFn: () => api<Invitation[]>(`/workspaces/${ws}/invitations`),
    enabled,
  });

export const useAuditEvents = (ws: string, q: AuditQuery, enabled: boolean) =>
  useQuery({
    queryKey: keys.audit(ws, q),
    queryFn: () => {
      const params = new URLSearchParams(
        Object.entries(q).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
      );
      return api<AuditEvent[]>(`/workspaces/${ws}/audit-events?${params.toString()}`);
    },
    enabled,
  });

/** Small helper: run a mutation, then refresh the given queries (and the audit log). */
function useWrite<TVars, TResult>(
  ws: string,
  fn: (v: TVars) => Promise<TResult>,
  refresh: readonly unknown[][],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        ...refresh.map((k) => qc.invalidateQueries({ queryKey: k })),
        qc.invalidateQueries({ queryKey: ['workspace', ws, 'audit'] }),
      ]);
    },
  });
}

export const useCreateService = (ws: string) =>
  useWrite(
    ws,
    (body: CreateServiceInput) =>
      api<Service>(`/workspaces/${ws}/services`, { method: 'POST', body: JSON.stringify(body) }),
    [[...keys.services(ws)]],
  );

export const useUpdateService = (ws: string) =>
  useWrite(
    ws,
    ({ id, ...body }: UpdateServiceInput & { id: string }) =>
      api<Service>(`/workspaces/${ws}/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    [[...keys.services(ws)]],
  );

export const useDeleteService = (ws: string) =>
  useWrite(
    ws,
    (id: string) => api<void>(`/workspaces/${ws}/services/${id}`, { method: 'DELETE' }),
    [[...keys.services(ws)]],
  );

export const useInvite = (ws: string) =>
  useWrite(
    ws,
    (body: InviteMemberInput) =>
      api<Invitation>(`/workspaces/${ws}/invitations`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [[...keys.invitations(ws)]],
  );

export const useRevokeInvitation = (ws: string) =>
  useWrite(
    ws,
    (id: string) => api<void>(`/workspaces/${ws}/invitations/${id}`, { method: 'DELETE' }),
    [[...keys.invitations(ws)]],
  );

export const useUpdateMemberRole = (ws: string) =>
  useWrite(
    ws,
    ({ id, role }: { id: string; role: Role }) =>
      api<Member>(`/workspaces/${ws}/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    [[...keys.members(ws)]],
  );

export const useRemoveMember = (ws: string) =>
  useWrite(ws, (id: string) => api<void>(`/workspaces/${ws}/members/${id}`, { method: 'DELETE' }), [
    [...keys.members(ws)],
  ]);

// ----- Incidents -----

const LIVE_MS = 5000;

export const incidentKeys = {
  list: (ws: string, q: IncidentListQuery) => ['workspace', ws, 'incidents', q] as const,
  one: (ws: string, id: string) => ['workspace', ws, 'incident', id] as const,
  timeline: (ws: string, id: string) => ['workspace', ws, 'incident', id, 'timeline'] as const,
  integrations: (ws: string) => ['workspace', ws, 'integrations'] as const,
  deadLetters: (ws: string) => ['workspace', ws, 'dead-letters'] as const,
};

const qs = (q: object) =>
  new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  ).toString();

/** Polls so new incidents and events show up without a reload (SSE comes in Phase 8). */
export const useIncidents = (ws: string, q: IncidentListQuery) =>
  useQuery({
    queryKey: incidentKeys.list(ws, q),
    queryFn: () => api<Incident[]>(`/workspaces/${ws}/incidents?${qs(q)}`),
    refetchInterval: LIVE_MS,
  });

export const useIncident = (ws: string, id: string) =>
  useQuery({
    queryKey: incidentKeys.one(ws, id),
    queryFn: () => api<Incident>(`/workspaces/${ws}/incidents/${id}`),
    refetchInterval: LIVE_MS,
  });

export const useTimeline = (ws: string, id: string) =>
  useQuery({
    queryKey: incidentKeys.timeline(ws, id),
    queryFn: () => api<TimelineEntry[]>(`/workspaces/${ws}/incidents/${id}/timeline`),
    refetchInterval: LIVE_MS,
  });

export const useCreateIncident = (ws: string) =>
  useWrite(
    ws,
    (body: CreateIncidentInput) =>
      api<Incident>(`/workspaces/${ws}/incidents`, { method: 'POST', body: JSON.stringify(body) }),
    [['workspace', ws, 'incidents']],
  );

export const useTransitionIncident = (ws: string, id: string) =>
  useWrite(
    ws,
    (body: TransitionIncidentInput) =>
      api<Incident>(`/workspaces/${ws}/incidents/${id}/transitions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [
      [...incidentKeys.one(ws, id)],
      [...incidentKeys.timeline(ws, id)],
      ['workspace', ws, 'incidents'],
    ],
  );

// ----- Integrations -----
export const useIntegrations = (ws: string) =>
  useQuery({
    queryKey: incidentKeys.integrations(ws),
    queryFn: () => api<Integration[]>(`/workspaces/${ws}/integrations`),
    refetchInterval: LIVE_MS,
  });

export const useCreateIntegration = (ws: string) =>
  useWrite(
    ws,
    (body: CreateIntegrationInput) =>
      api<IntegrationWithSecret>(`/workspaces/${ws}/integrations`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [[...incidentKeys.integrations(ws)]],
  );

export const useIntegrationAction = (ws: string) =>
  useWrite(
    ws,
    async ({
      id,
      action,
    }: {
      id: string;
      action: 'test' | 'rotate-secret' | 'disconnect';
    }): Promise<IntegrationWithSecret | undefined> => {
      if (action === 'disconnect') {
        await api<void>(`/workspaces/${ws}/integrations/${id}`, { method: 'DELETE' });
        return undefined;
      }
      return api<IntegrationWithSecret>(`/workspaces/${ws}/integrations/${id}/${action}`, {
        method: 'POST',
      });
    },
    [[...incidentKeys.integrations(ws)]],
  );

export const useDeadLetters = (ws: string, enabled: boolean) =>
  useQuery({
    queryKey: incidentKeys.deadLetters(ws),
    queryFn: () => api<DeadLetter[]>(`/workspaces/${ws}/ingest/dead-letters`),
    enabled,
  });

export const useReplayDeadLetter = (ws: string) =>
  useWrite(
    ws,
    (id: string) =>
      api<void>(`/workspaces/${ws}/ingest/dead-letters/${id}/replay`, { method: 'POST' }),
    [[...incidentKeys.deadLetters(ws)]],
  );

// ----- GitHub -----
export const useGitHubApp = (ws: string, enabled: boolean) =>
  useQuery({
    queryKey: ['workspace', ws, 'github-app'],
    queryFn: () => api<GitHubAppInfo>(`/workspaces/${ws}/github/app`),
    enabled,
  });

export const useConnectGitHub = (ws: string) =>
  useWrite(
    ws,
    (installationId: number) =>
      api<Integration>(`/workspaces/${ws}/github/connect`, {
        method: 'POST',
        body: JSON.stringify({ installationId }),
      }),
    [
      [...incidentKeys.integrations(ws)],
      ['workspace', ws, 'github-app'],
      ['workspace', ws, 'repo-access'],
    ],
  );

export const useRepositoryAccess = (ws: string) =>
  useQuery({
    queryKey: ['workspace', ws, 'repo-access'],
    queryFn: () => api<RepositoryAccess[]>(`/workspaces/${ws}/github/repository-access`),
  });

export const useServiceCommits = (ws: string, serviceId: string | null) =>
  useQuery({
    queryKey: ['workspace', ws, 'service', serviceId, 'commits'],
    queryFn: () => api<RepoCommit[]>(`/workspaces/${ws}/services/${serviceId}/commits?limit=5`),
    enabled: !!serviceId,
    retry: false,
  });

// ----- Investigations -----
export const useInvestigation = (ws: string, incidentId: string) =>
  useQuery({
    queryKey: ['workspace', ws, 'incident', incidentId, 'investigation'],
    queryFn: () =>
      api<IncidentInvestigation>(`/workspaces/${ws}/incidents/${incidentId}/investigation`),
    // Poll faster while an investigation is running.
    refetchInterval: (q) => (q.state.data?.workflow?.phase === 'investigating' ? 2000 : 8000),
  });

export const useEvidence = (ws: string, incidentId: string, evidenceId: string | null) =>
  useQuery({
    queryKey: ['workspace', ws, 'incident', incidentId, 'evidence', evidenceId],
    queryFn: () =>
      api<{ ref: string; title: string; content: string }>(
        `/workspaces/${ws}/incidents/${incidentId}/evidence/${evidenceId}`,
      ),
    enabled: !!evidenceId,
    staleTime: Infinity,
  });

export const useIncidentAction = (ws: string, incidentId: string) =>
  useWrite(
    ws,
    (body: IncidentActionInput) =>
      api<IncidentInvestigation>(`/workspaces/${ws}/incidents/${incidentId}/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [
      ['workspace', ws, 'incident', incidentId],
      ['workspace', ws, 'incidents'],
    ],
  );

// ----- Fixes (Phase 5) -----
export const useFixes = (ws: string, incidentId: string) =>
  useQuery({
    queryKey: ['workspace', ws, 'incident', incidentId, 'fixes'],
    queryFn: () => api<IncidentFixes>(`/workspaces/${ws}/incidents/${incidentId}/fixes`),
    refetchInterval: (q) =>
      ['reproducing', 'patching', 'validating', 'reproduction_approved'].includes(
        q.state.data?.phase ?? '',
      )
        ? 2000
        : 8000,
  });

// ----- Recovery verification (Phase 7) -----
export const useVerification = (ws: string, incidentId: string) =>
  useQuery({
    queryKey: ['workspace', ws, 'incident', incidentId, 'verification'],
    queryFn: () =>
      api<IncidentVerification>(`/workspaces/${ws}/incidents/${incidentId}/verification`),
    refetchInterval: 10000,
  });

export const useFixAction = (ws: string, incidentId: string) =>
  useWrite(
    ws,
    (body: FixActionInput) =>
      api<IncidentFixes>(`/workspaces/${ws}/incidents/${incidentId}/fixes/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [['workspace', ws, 'incident', incidentId]],
  );

export const usePullRequests = (ws: string) =>
  useQuery({
    queryKey: ['workspace', ws, 'pull-requests'],
    queryFn: () => api<PullRequestView[]>(`/workspaces/${ws}/pull-requests`),
    refetchInterval: 15000,
  });

export const useSyncPullRequest = (ws: string) =>
  useWrite(
    ws,
    (id: string) =>
      api<PullRequestView>(`/workspaces/${ws}/pull-requests/${id}/sync`, { method: 'POST' }),
    [
      ['workspace', ws, 'pull-requests'],
      ['workspace', ws, 'incident'],
    ],
  );
