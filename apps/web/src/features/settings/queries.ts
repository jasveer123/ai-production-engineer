'use client';

import type {
  ApprovalPolicyInput,
  NotificationChannel,
  NotificationDelivery,
  SeverityRule,
} from '@ape/api-contracts';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';

export const settingsKeys = {
  severityRules: (ws: string) => ['ws', ws, 'settings', 'severity-rules'] as const,
  approvalPolicy: (ws: string) => ['ws', ws, 'settings', 'approval-policy'] as const,
  notifications: (ws: string) => ['ws', ws, 'notifications'] as const,
  channels: (ws: string) => ['ws', ws, 'notifications', 'channels'] as const,
  deliveries: (ws: string) => ['ws', ws, 'notifications', 'deliveries'] as const,
};

export function useSeverityRules() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: settingsKeys.severityRules(workspace.id),
    queryFn: () => api<SeverityRule[]>(`/workspaces/${workspace.id}/settings/severity-rules`),
  });
}

export function useApprovalPolicy() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: settingsKeys.approvalPolicy(workspace.id),
    queryFn: () => api<ApprovalPolicyInput>(`/workspaces/${workspace.id}/settings/approval-policy`),
  });
}

export function useNotificationChannels() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: settingsKeys.channels(workspace.id),
    queryFn: () => api<NotificationChannel[]>(`/workspaces/${workspace.id}/notifications/channels`),
  });
}

/** Admins only (the API refuses others), so callers pass `enabled`. */
export function useNotificationDeliveries(enabled: boolean) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: settingsKeys.deliveries(workspace.id),
    queryFn: () =>
      api<NotificationDelivery[]>(`/workspaces/${workspace.id}/notifications/deliveries`),
    enabled,
  });
}
