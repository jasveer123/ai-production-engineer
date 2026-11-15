import { useQuery } from "@tanstack/react-query"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useTraceDetail(workspaceId: string | undefined, traceId: string) {
  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.trace(workspaceId ?? "", traceId),
    queryFn: () => exploreService.trace(workspaceId!, traceId),
    enabled: Boolean(workspaceId && traceId),
  })
}
