import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"
import { AUTH_TOAST } from "../constants"

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.SIGNED_IN },
    mutationFn: authService.login,
    onSuccess: (session) => queryClient.setQueryData(AUTH_QUERY_KEYS.session, session),
  })
}
