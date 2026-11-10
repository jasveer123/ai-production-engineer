import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { INCIDENT_POLL_MS } from "../constants"
import { INCIDENT_QUERY_KEYS } from "../query-keys"
import { incidentsService } from "../services"

export function usePullRequests(workspaceId: string | undefined) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.pullRequests(workspaceId ?? ""),
    queryFn: () => incidentsService.pullRequests(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: INCIDENT_POLL_MS,
  })
}

export function useSyncPullRequest(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Pull request refreshed" },
    mutationFn: (id: string) => incidentsService.syncPullRequest(workspaceId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.pullRequests(workspaceId) }),
  })
}
