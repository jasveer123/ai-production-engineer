import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AUTH_TOAST } from "../constants"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.WORKSPACE_CREATED },
    mutationFn: authService.createWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.session }),
  })
}
