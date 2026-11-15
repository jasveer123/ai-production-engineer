import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DETAIL_POLL_MS, INCIDENT_POLL_MS } from "../constants"
import { INCIDENT_QUERY_KEYS } from "../query-keys"
import type {
  IncidentListFilters,
  IncidentUpdate,
  ReportIncidentRequest,
  ResponseRequest,
} from "../response-schemas"
import { responseService } from "../services"

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all(workspaceId) })
}

export function useIncidentList(workspaceId: string | undefined, filters: IncidentListFilters) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.filtered(workspaceId ?? "", filters),
    queryFn: () => responseService.list(workspaceId!, filters),
    enabled: Boolean(workspaceId),
    refetchInterval: INCIDENT_POLL_MS,
    placeholderData: (previous) => previous,
  })
}

export function useActivity(workspaceId: string, id: string) {
  return useInfiniteQuery({
    queryKey: INCIDENT_QUERY_KEYS.activity(workspaceId, id),
    queryFn: ({ pageParam }) => responseService.activity(workspaceId, id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function useIncidentContext(workspaceId: string, id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.context(workspaceId, id),
    queryFn: () => responseService.context(workspaceId, id),
    refetchInterval: DETAIL_POLL_MS,
  })
}

export function usePolicyOptions(workspaceId: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.policies(workspaceId),
    queryFn: () => responseService.policies(workspaceId),
  })
}

export function useMemberOptions(workspaceId: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.members(workspaceId),
    queryFn: () => responseService.members(workspaceId),
  })
}

export function useRespond(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Incident updated" },
    mutationFn: (body: ResponseRequest) => responseService.respond(workspaceId, id, body),
    onSettled: refresh,
  })
}

export function useEscalate(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Escalated" },
    mutationFn: (policyId?: string) => responseService.escalate(workspaceId, id, policyId),
    onSuccess: refresh,
  })
}

export function useUpdateIncident(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Saved" },
    mutationFn: (body: IncidentUpdate) => responseService.update(workspaceId, id, body),
    onSettled: refresh,
  })
}

export function useRemoveIncident(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Incident removed" },
    mutationFn: () => responseService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useReportIncident(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Incident reported" },
    mutationFn: (body: ReportIncidentRequest) => responseService.report(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useComments(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  const create = useMutation({
    mutationFn: (body: string) => responseService.comment(workspaceId, id, body),
    onSuccess: refresh,
  })
  const edit = useMutation({
    mutationFn: (v: { commentId: string; body: string }) =>
      responseService.editComment(workspaceId, id, v.commentId, v.body),
    onSuccess: refresh,
  })
  const remove = useMutation({
    meta: { successMessage: "Comment deleted" },
    mutationFn: (commentId: string) => responseService.deleteComment(workspaceId, id, commentId),
    onSuccess: refresh,
  })
  return { create, edit, remove }
}

export function usePostMortem(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Post-mortem saved" },
    mutationFn: (body: string) => responseService.postMortem(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useSaveMetadata(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Metadata saved" },
    mutationFn: (metadata: Record<string, string>) =>
      responseService.metadata(workspaceId, id, metadata),
    onSuccess: refresh,
  })
}
