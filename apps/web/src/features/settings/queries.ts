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

export function useSeverityRules() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'settings', 'severity-rules'],
    queryFn: () => api<SeverityRule[]>(`/workspaces/${workspace.id}/settings/severity-rules`),
  });
}

export function useApprovalPolicy() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'settings', 'approval-policy'],
    queryFn: () => api<ApprovalPolicyInput>(`/workspaces/${workspace.id}/settings/approval-policy`),
  });
}

export function useNotificationChannels() {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'notifications', 'channels'],
    queryFn: () => api<NotificationChannel[]>(`/workspaces/${workspace.id}/notifications/channels`),
  });
}

export function useNotificationDeliveries(enabled: boolean) {
  const { workspace } = useSession();
  return useQuery({
    queryKey: ['ws', workspace.id, 'notifications', 'deliveries'],
    queryFn: () =>
      api<NotificationDelivery[]>(`/workspaces/${workspace.id}/notifications/deliveries`),
    enabled,
  });
}
