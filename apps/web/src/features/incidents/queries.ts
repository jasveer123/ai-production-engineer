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

export function useIncidents(filters: Omit<IncidentListQuery, 'limit'>) {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: ['ws', ws, 'incidents', filters],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: '100' });
      for (const [k, v] of Object.entries(filters)) if (v) sp.set(k, String(v));
      return api<Incident[]>(`/workspaces/${ws}/incidents?${sp}`);
    },
    refetchInterval: POLL_MS,
  });
}

const incidentKey = (ws: string, id: string, part: string) => ['ws', ws, 'incident', id, part];
export const incidentPrefix = (ws: string, id: string) => ['ws', ws, 'incident', id];

function useIncidentPart<T>(id: string, part: string, path: string) {
  const ws = useWorkspaceId();
  return useQuery({
    queryKey: incidentKey(ws, id, part),
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
    queryKey: ['ws', ws, 'incident', incident?.id, 'logs', window],
    queryFn: () => api<LogSearchResult>(`/workspaces/${ws}/logs?${new URLSearchParams(window!)}`),
    enabled: Boolean(window),
  });
}
