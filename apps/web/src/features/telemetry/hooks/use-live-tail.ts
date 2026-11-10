import { useQuery } from "@tanstack/react-query"
import { LIVE_LIMIT, LIVE_POLL_MS, TIME_RANGES, type TimeRangeId } from "../constants"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { logsService } from "../services"

export function useLiveTail(
  workspaceId: string | undefined,
  query: string,
  range: TimeRangeId,
  paused: boolean
) {
  const windowMs = TIME_RANGES.find((item) => item.id === range)!.ms

  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.live(workspaceId ?? "", query, range),
    queryFn: () =>
      logsService.search(workspaceId!, {
        q: query,
        limit: LIVE_LIMIT,
        from: new Date(Date.now() - windowMs).toISOString(),
      }),
    enabled: Boolean(workspaceId),
    refetchInterval: paused ? false : LIVE_POLL_MS,
    placeholderData: (previous) => previous,
  })
}
