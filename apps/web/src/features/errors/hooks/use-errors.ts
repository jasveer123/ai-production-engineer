import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ERRORS_POLL_MS } from "../constants"
import { errorsService } from "../services"
import type { ErrorUpdate } from "../services/errors.service"
import type { ErrorFilters } from "../schemas"

export function useErrors(workspaceId: string | undefined, filters: ErrorFilters) {
  const query = Object.fromEntries(
    Object.entries(filters)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v && v !== "all")
  )
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "list", query],
    queryFn: () => errorsService.list(workspaceId!, query),
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
    mutationFn: (body: ErrorUpdate) => errorsService.update(workspaceId, id, body),
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

export function useErrorApps(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "apps"],
    queryFn: () => errorsService.apps(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: ERRORS_POLL_MS,
  })
}

export function useCreateErrorApp(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Application created" },
    mutationFn: (body: { name: string; platform: string }) =>
      errorsService.createApp(workspaceId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}

export function useUpdateErrorApp(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Spike protection updated" },
    mutationFn: ({ id, rateLimitPerMinute }: { id: string; rateLimitPerMinute: number }) =>
      errorsService.updateApp(workspaceId, id, { rateLimitPerMinute }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}

export function useRemoveErrorApp(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Application removed" },
    mutationFn: (id: string) => errorsService.removeApp(workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}
