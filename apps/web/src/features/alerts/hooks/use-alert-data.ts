import { useQuery } from "@tanstack/react-query"
import { ALERT_POLL_MS } from "../constants"
import { ALERT_QUERY_KEYS } from "../query-keys"
import { alertsService } from "../services"

export function useAlertFeed(workspaceId: string | undefined, status: string) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.feed(workspaceId ?? "", status),
    queryFn: () => alertsService.alerts(workspaceId!, status),
    enabled: Boolean(workspaceId),
    refetchInterval: ALERT_POLL_MS,
    placeholderData: (previous) => previous,
  })
}

export function useAlertSources(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.sources(workspaceId ?? ""),
    queryFn: () => alertsService.sources(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: ALERT_POLL_MS,
  })
}

export function useAlertRoutes(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.routes(workspaceId ?? ""),
    queryFn: () => alertsService.routes(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useHeartbeatDetail(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.heartbeat(workspaceId ?? "", id),
    queryFn: () => alertsService.heartbeat(workspaceId!, id),
    enabled: Boolean(workspaceId && id),
    refetchInterval: ALERT_POLL_MS,
  })
}

export function useSourceAlerts(workspaceId: string | undefined, sourceId: string) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.sourceAlerts(workspaceId ?? "", sourceId),
    queryFn: () => alertsService.alerts(workspaceId!, "all", sourceId),
    enabled: Boolean(workspaceId && sourceId),
    refetchInterval: ALERT_POLL_MS,
  })
}

export function useSourceReceipts(workspaceId: string, sourceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ALERT_QUERY_KEYS.receipts(workspaceId, sourceId),
    queryFn: () => alertsService.receipts(workspaceId, sourceId),
    enabled,
    refetchInterval: enabled ? ALERT_POLL_MS : false,
  })
}
