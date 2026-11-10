import { useQuery } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { pullRequestsService } from "../services"

export function usePullRequests(workspaceId: string | undefined, live: boolean) {
  return useQuery({
    queryKey: INTEGRATIONS_QUERY_KEYS.pullRequests(workspaceId ?? ""),
    queryFn: () => pullRequestsService.list(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: live ? POLL_INTERVAL_MS.WORK : false,
  })
}
