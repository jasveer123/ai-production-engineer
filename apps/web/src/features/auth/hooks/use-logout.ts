import { useMutation, useQueryClient } from "@tanstack/react-query"
import { authService } from "../services"
import { AUTH_TOAST } from "../constants"

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.SIGNED_OUT },
    mutationFn: authService.logout,
    onSuccess: () => queryClient.clear(),
  })
}
