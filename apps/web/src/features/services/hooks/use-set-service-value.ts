import { useMutation, useQueryClient } from "@tanstack/react-query"
import { servicesService } from "../services"
import type { SetValueRequest } from "../schemas"

export function useSetServiceValue(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Value saved" },
    mutationFn: (request: SetValueRequest) => servicesService.setValue(workspaceId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services", workspaceId] }),
  })
}
