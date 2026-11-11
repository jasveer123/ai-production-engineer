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
