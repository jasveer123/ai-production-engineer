'use client';

import type { AlertRoute, AlertSource, AlertView } from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export const alertsKey = (ws: string) => ['ws', ws, 'alerts'] as const;

export function useAlerts(status?: 'firing' | 'resolved') {
  const { workspace } = useSession();
  return useQuery({
    queryKey: [...alertsKey(workspace.id), 'list', status ?? 'all'],
    queryFn: () =>
      api<AlertView[]>(`/workspaces/${workspace.id}/alerts${status ? `?status=${status}` : ''}`),
    // Alerts arrive from outside tools; keep the list current without a reload.
    refetchInterval: 15_000,
  });
}

export function useAlertSources() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: [...alertsKey(workspace.id), 'sources'],
    queryFn: () => api<AlertSource[]>(`/workspaces/${workspace.id}/alert-sources`),
    refetchInterval: 30_000,
  });
}

export function useAlertRoutes() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: [...alertsKey(workspace.id), 'routes'],
    queryFn: () => api<AlertRoute[]>(`/workspaces/${workspace.id}/alert-routes`),
  });
}
