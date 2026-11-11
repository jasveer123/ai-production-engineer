import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { STATUS_POLL_MS } from "../constants"
import { statusService } from "../services"
import type { PageRequest, UpdateRequest } from "../schemas"

export function useStatusPages(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["status", workspaceId ?? "", "pages"],
    queryFn: () => statusService.list(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function usePublicStatus(slug: string) {
  return useQuery({
    queryKey: ["status", "public", slug],
    queryFn: () => statusService.publicView(slug),
    refetchInterval: STATUS_POLL_MS,
    retry: false,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["status", workspaceId] })
}

export function useCreatePage(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Status page created" },
    mutationFn: (body: PageRequest) => statusService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useSetMonitors(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Components updated" },
    mutationFn: ({ id, monitorIds }: { id: string; monitorIds: string[] }) =>
      statusService.update(workspaceId, id, { monitorIds }),
    onSuccess: refresh,
  })
}

export function useDeletePage(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Status page deleted" },
    mutationFn: (id: string) => statusService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function usePostUpdate(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Update posted" },
    mutationFn: (body: UpdateRequest) => statusService.postUpdate(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useRemoveUpdate(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Update removed" },
    mutationFn: (updateId: string) => statusService.removeUpdate(workspaceId, id, updateId),
    onSuccess: refresh,
  })
}
