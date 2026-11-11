import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ERRORS_POLL_MS } from "../constants"
import { errorsService } from "../services"

export function useErrors(workspaceId: string | undefined, status: string, q: string) {
  return useQuery({
    queryKey: ["errors", workspaceId ?? "", "list", status, q],
    queryFn: () =>
      errorsService.list(workspaceId!, {
        ...(status !== "all" ? { status } : {}),
        ...(q ? { q } : {}),
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

export function useSetErrorStatus(workspaceId: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Status updated" },
    mutationFn: (status: string) => errorsService.setStatus(workspaceId, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["errors", workspaceId] }),
  })
}
