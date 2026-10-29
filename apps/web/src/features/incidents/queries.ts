'use client';

import type {
  Incident,
  IncidentFixes,
  IncidentInvestigation,
  IncidentListQuery,
  IncidentVerification,
  LogSearchResult,
  TimelineEntry,
} from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/features/auth/session';
import { api } from '@/lib/api';
import { incidentLogWindow } from './live';

const POLL_MS = 60_000;

export const incidentKeys = {
  all: (ws: string) => ['ws', ws, 'incidents'] as const,
  list: (ws: string, filters: object) => [...incidentKeys.all(ws), filters] as const,
  detail: (ws: string, id: string) => ['ws', ws, 'incident', id] as const,
  part: (ws: string, id: string, part: string) => [...incidentKeys.detail(ws, id), part] as const,
};

export function useIncidents(filters: Omit<IncidentListQuery, 'limit'>) {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: incidentKeys.list(ws, filters),
    queryFn: () => {
      const sp = new URLSearchParams({ limit: '100' });
      for (const [k, v] of Object.entries(filters)) if (v) sp.set(k, String(v));
      return api<Incident[]>(`/workspaces/${ws}/incidents?${sp}`);
    },
    refetchInterval: POLL_MS,
  });
}

function useIncidentPart<T>(id: string, part: string, path: string) {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: incidentKeys.part(ws, id, part),
    queryFn: () => api<T>(`/workspaces/${ws}/incidents/${id}${path}`),
    refetchInterval: POLL_MS,
  });
}

export const useIncident = (id: string) => useIncidentPart<Incident>(id, 'incident', '');
export const useTimeline = (id: string) =>
  useIncidentPart<TimelineEntry[]>(id, 'timeline', '/timeline');
export const useInvestigation = (id: string) =>
  useIncidentPart<IncidentInvestigation>(id, 'investigation', '/investigation');
export const useFixes = (id: string) => useIncidentPart<IncidentFixes>(id, 'fixes', '/fixes');
export const useVerification = (id: string) =>
  useIncidentPart<IncidentVerification>(id, 'verification', '/verification');

export function useIncidentLogs(incident: Incident | undefined) {
  const ws = useWorkspaceId();
  const window = incident ? incidentLogWindow(incident) : null;
  return useQuery({
    queryKey: incidentKeys.part(ws, incident?.id ?? '', `logs:${JSON.stringify(window)}`),
    queryFn: () => api<LogSearchResult>(`/workspaces/${ws}/logs?${new URLSearchParams(window!)}`),
    enabled: Boolean(window),
  });
}
