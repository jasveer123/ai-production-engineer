import { useQuery } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { incidentsService } from "../services"

export function useOpenIncidents(workspaceId: string | undefined, live: boolean) {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEYS.incidents(workspaceId ?? ""),
    queryFn: () => incidentsService.listOpen(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: live ? POLL_INTERVAL_MS.WORK : false,
  })
}
