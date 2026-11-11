import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ONCALL_POLL_MS } from "../constants"
import { oncallService } from "../services"
import type { OverrideRequest, ScheduleRequest } from "../schemas"

const keyOf = (workspaceId: string, part: string) => ["oncall", workspaceId, part]

export function useSchedules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "schedules"),
    queryFn: () => oncallService.list(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: ONCALL_POLL_MS,
  })
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", "members"),
    queryFn: () => oncallService.members(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["oncall", workspaceId] })
}

export function useSaveSchedule(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Schedule saved" },
    mutationFn: ({ id, body }: { id: string | null; body: ScheduleRequest }) =>
      id ? oncallService.update(workspaceId, id, body) : oncallService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useDeleteSchedule(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Schedule deleted" },
    mutationFn: (id: string) => oncallService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useAddOverride(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Swap saved" },
    mutationFn: ({ id, body }: { id: string; body: OverrideRequest }) =>
      oncallService.addOverride(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useRemoveOverride(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Swap removed" },
    mutationFn: (id: string) => oncallService.removeOverride(workspaceId, id),
    onSuccess: refresh,
  })
}
