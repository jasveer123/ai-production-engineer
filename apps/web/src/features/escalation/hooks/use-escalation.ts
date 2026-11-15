import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ESCALATION_POLL_MS } from "../constants"
import { escalationService } from "../services"
import type { PolicyRequest, SimplePolicyRequest } from "../schemas"

const keyOf = (workspaceId: string, part: string) => ["escalation", workspaceId, part]

export function usePolicies(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "policies"),
    queryFn: () => escalationService.policies(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useRuns(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "runs"),
    queryFn: () => escalationService.runs(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: ESCALATION_POLL_MS,
  })
}

export function usePolicyPreview(workspaceId: string, id: string, enabled: boolean) {
  return useQuery({
    queryKey: keyOf(workspaceId, `preview:${id}`),
    queryFn: () => escalationService.preview(workspaceId, id),
    enabled,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["escalation", workspaceId] })
}

export function useCreatePolicy(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Policy saved" },
    mutationFn: (body: PolicyRequest) => escalationService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useUpdatePolicy(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Policy saved" },
    mutationFn: ({ id, body }: { id: string; body: Partial<PolicyRequest> }) =>
      escalationService.update(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useTogglePolicy(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Policy updated" },
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      escalationService.update(workspaceId, id, { enabled }),
    onSuccess: refresh,
  })
}

export function useDeletePolicy(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Policy deleted" },
    mutationFn: (id: string) => escalationService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useSaveSimplePolicy(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Policy saved" },
    mutationFn: (body: SimplePolicyRequest) => escalationService.saveSimple(workspaceId, body),
    onSuccess: refresh,
  })
}
