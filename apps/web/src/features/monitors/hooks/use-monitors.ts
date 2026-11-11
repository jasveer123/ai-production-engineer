import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MONITOR_POLL_MS } from "../constants"
import { monitorsService } from "../services"
import type { CreateMonitorRequest, UpdateMonitorRequest } from "../schemas"

const keyOf = (workspaceId: string, ...rest: string[]) => ["monitors", workspaceId, ...rest]

export function useMonitors(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "list"),
    queryFn: () => monitorsService.list(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: MONITOR_POLL_MS,
  })
}

export function useMonitor(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "one", id),
    queryFn: () => monitorsService.get(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: MONITOR_POLL_MS,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["monitors", workspaceId] })
}

export function useCreateMonitor(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Monitor created" },
    mutationFn: (body: CreateMonitorRequest) => monitorsService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useUpdateMonitor(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMonitorRequest }) =>
      monitorsService.update(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useDeleteMonitor(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Monitor deleted" },
    mutationFn: (id: string) => monitorsService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useCheckNow(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Checked" },
    mutationFn: (id: string) => monitorsService.check(workspaceId, id),
    onSuccess: refresh,
  })
}
