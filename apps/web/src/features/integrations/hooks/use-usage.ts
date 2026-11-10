import { useQuery } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useUsage(workspaceId: string | undefined, live: boolean) {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEYS.usage(workspaceId ?? ""),
    queryFn: () => ingestService.usage(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: live ? POLL_INTERVAL_MS.USAGE : false,
  })
}
