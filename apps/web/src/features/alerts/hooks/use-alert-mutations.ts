import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ALERT_QUERY_KEYS } from "../query-keys"
import { alertsService } from "../services"
import type { CreateSourceRequest, RouteRequest } from "../schemas"

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ALERT_QUERY_KEYS.all(workspaceId) })
}

export function useCreateSource(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Source created" },
    mutationFn: (body: CreateSourceRequest) => alertsService.createSource(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useRotateSource(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Token replaced" },
    mutationFn: (id: string) => alertsService.rotateSource(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useDeleteSource(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Source deleted" },
    mutationFn: (id: string) => alertsService.deleteSource(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useSaveRoute(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Route saved" },
    mutationFn: ({ id, body }: { id: string | null; body: RouteRequest }) =>
      id
        ? alertsService.updateRoute(workspaceId, id, body)
        : alertsService.createRoute(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useToggleRoute(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      alertsService.updateRoute(workspaceId, id, { enabled }),
    onSuccess: refresh,
  })
}

export function useDeleteRoute(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Route deleted" },
    mutationFn: (id: string) => alertsService.deleteRoute(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useReorderRoutes(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: (ids: string[]) => alertsService.reorderRoutes(workspaceId, ids),
    onSuccess: refresh,
  })
}
