import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"
import { AUTH_TOAST } from "../constants"

export function useResetPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.PASSWORD_UPDATED },
    mutationFn: authService.resetPassword,
    onSuccess: (session) => queryClient.setQueryData(AUTH_QUERY_KEYS.session, session),
  })
}
