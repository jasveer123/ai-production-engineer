import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { statusService } from "../services"
import type { PageRequest, SettingsRequest } from "../requests"

export const statusKeys = {
  all: (ws: string) => ["status", ws] as const,
  pages: (ws: string) => ["status", ws, "pages"] as const,
  page: (ws: string, id: string) => ["status", ws, "page", id] as const,
  part: (ws: string, id: string, part: string) => ["status", ws, "page", id, part] as const,
}

export function useRefreshStatus(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: statusKeys.all(workspaceId) })
}

export function useStatusPages(workspaceId: string | undefined) {
  return useQuery({
    queryKey: statusKeys.pages(workspaceId ?? ""),
    queryFn: () => statusService.list(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useStatusPage(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: statusKeys.page(workspaceId ?? "", id),
    queryFn: () => statusService.get(workspaceId!, id),
    enabled: Boolean(workspaceId),
    retry: false,
  })
}

export function useCreatePage(workspaceId: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Status page created" },
    mutationFn: (body: PageRequest) => statusService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useUpdatePage(workspaceId: string, id: string, successMessage = "Settings saved") {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage },
    mutationFn: (body: SettingsRequest) => statusService.update(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useDeletePage(workspaceId: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Status page deleted" },
    mutationFn: (id: string) => statusService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useVerifyDomain(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Domain verified" },
    mutationFn: () => statusService.verifyDomain(workspaceId, id),
    onSuccess: refresh,
  })
}
