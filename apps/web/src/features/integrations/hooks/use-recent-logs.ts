import { useQuery } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useRecentLogs(workspaceId: string | undefined, query: string) {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEYS.logs(workspaceId ?? "", query),
    queryFn: () => ingestService.recentLogs(workspaceId!, query),
    enabled: Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL_MS.LOGS,
  })
}
