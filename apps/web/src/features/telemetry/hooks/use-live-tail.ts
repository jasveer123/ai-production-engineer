import { useQuery } from "@tanstack/react-query"
import { LIVE_LIMIT, LIVE_POLL_MS } from "../constants"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { logsService } from "../services"

export function useLiveTail(workspaceId: string | undefined, query: string, paused: boolean) {
  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.live(workspaceId ?? "", query),
    queryFn: () => logsService.search(workspaceId!, { q: query, limit: LIVE_LIMIT }),
    enabled: Boolean(workspaceId),
    refetchInterval: paused ? false : LIVE_POLL_MS,
    placeholderData: (previous) => previous,
  })
}
