import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ERRORS_POLL_MS } from "../constants"
import { errorsService } from "../services"

export function useErrors(
  workspaceId: string | undefined,
  status: string,
  q: string,
  assignee: string
) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "list", status, q, assignee],
    queryFn: () =>
      errorsService.list(workspaceId!, {
        ...(status !== "all" ? { status } : {}),
        ...(q ? { q } : {}),
        ...(assignee !== "all" ? { assignee } : {}),
      }),
    enabled: Boolean(workspaceId),
    refetchInterval: ERRORS_POLL_MS,
  })
}

export function useError(workspaceId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "one", id],
    queryFn: () => errorsService.get(workspaceId!, id),
    enabled: Boolean(workspaceId),
    refetchInterval: ERRORS_POLL_MS,
  })
}

export function useUpdateError(workspaceId: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Error updated" },
    mutationFn: (body: { status?: string; assigneeId?: string | null }) =>
      errorsService.update(workspaceId, id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}

export function useReleases(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "releases"],
    queryFn: () => errorsService.releases(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useSourceMaps(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "source-maps"],
    queryFn: () => errorsService.sourceMaps(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useUploadSourceMap(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Source map uploaded" },
    mutationFn: (body: { release: string; file: string; map: string }) =>
      errorsService.uploadSourceMap(workspaceId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}

export function useRemoveSourceMap(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Source map removed" },
    mutationFn: (id: string) => errorsService.removeSourceMap(workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}
