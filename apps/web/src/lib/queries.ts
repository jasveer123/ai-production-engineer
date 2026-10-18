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
  Role,
  Service,
  UpdateServiceInput,
  Workspace,
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
