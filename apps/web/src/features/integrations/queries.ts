'use client';

import type { IngestOverview, Integration, ToolView } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/features/auth/session';
import { api } from '@/lib/api';

/** Ingest tokens and per-way status. Polls so tiles turn green soon after the first data. */
export function useIngestOverview() {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: ['ws', ws, 'ingest'],
    queryFn: () => api<IngestOverview>(`/workspaces/${ws}/ingest`),
    refetchInterval: 10_000,
  });
}

export function useTools() {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: ['ws', ws, 'tools'],
    queryFn: () => api<ToolView[]>(`/workspaces/${ws}/tools`),
  });
}

export function useIntegrations() {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: ['ws', ws, 'integrations'],
    queryFn: () => api<Integration[]>(`/workspaces/${ws}/integrations`),
  });
}
