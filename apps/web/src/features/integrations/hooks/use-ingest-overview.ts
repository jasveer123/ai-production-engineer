import { useQuery } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useIngestOverview(workspaceId: string | undefined, live = true) {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEYS.overview(workspaceId ?? ""),
    queryFn: () => ingestService.overview(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: live ? POLL_INTERVAL_MS.OVERVIEW : false,
  })
}
