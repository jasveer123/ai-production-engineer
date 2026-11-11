import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { logAlertsService } from "../services"
import type { LogAlertRequest } from "../schemas"

const keyOf = (workspaceId: string) => ["log-alerts", workspaceId]

export function useLogAlerts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? ""),
    queryFn: () => logAlertsService.list(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: keyOf(workspaceId) })
}

export function useCreateLogAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Log alert created" },
    mutationFn: (body: LogAlertRequest) => logAlertsService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function usePauseLogAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Log alert updated" },
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      logAlertsService.update(workspaceId, id, { paused }),
    onSuccess: refresh,
  })
}

export function useDeleteLogAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Log alert deleted" },
    mutationFn: (id: string) => logAlertsService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useCheckLogAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Checked" },
    mutationFn: (id: string) => logAlertsService.check(workspaceId, id),
    onSuccess: refresh,
  })
}
