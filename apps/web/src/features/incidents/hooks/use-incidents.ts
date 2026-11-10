import { useQuery } from "@tanstack/react-query"
import { INCIDENT_POLL_MS } from "../constants"
import { INCIDENT_QUERY_KEYS } from "../query-keys"
import { incidentsService } from "../services"

export function useIncidents(workspaceId: string | undefined, status: string, severity: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.list(workspaceId ?? "", status, severity),
    queryFn: () => incidentsService.list(workspaceId!, status, severity),
    enabled: Boolean(workspaceId),
    refetchInterval: INCIDENT_POLL_MS,
    placeholderData: (previous) => previous,
  })
}
