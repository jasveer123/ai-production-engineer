import { useQuery } from "@tanstack/react-query"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useLogContext(workspaceId: string | undefined, logId: number | null) {
  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.context(workspaceId ?? "", logId ?? 0),
    queryFn: () => exploreService.context(workspaceId!, logId!),
    enabled: Boolean(workspaceId && logId),
  })
}
