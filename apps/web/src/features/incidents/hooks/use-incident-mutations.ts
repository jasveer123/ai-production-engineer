import { useMutation, useQueryClient } from "@tanstack/react-query"
import { INCIDENT_QUERY_KEYS } from "../query-keys"
import { incidentsService } from "../services"
import type { FeedbackRequest, FixActionRequest, IncidentActionRequest } from "../schemas"

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all(workspaceId) })
}

export function useIncidentAction(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Done" },
    mutationFn: (body: IncidentActionRequest) => incidentsService.act(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useFixAction(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Done" },
    mutationFn: (body: FixActionRequest) => incidentsService.fixAction(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useHypothesisFeedback(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Thanks, noted" },
    mutationFn: (body: FeedbackRequest) => incidentsService.feedback(workspaceId, id, body),
    onSuccess: refresh,
  })
}
