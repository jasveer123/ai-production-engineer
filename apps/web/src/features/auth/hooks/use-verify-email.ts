import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AUTH_TOAST } from "../constants"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"

export function useVerifyEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.EMAIL_CONFIRMED },
    mutationFn: authService.verifyEmail,
    onSuccess: (session) => queryClient.setQueryData(AUTH_QUERY_KEYS.session, session),
  })
}
