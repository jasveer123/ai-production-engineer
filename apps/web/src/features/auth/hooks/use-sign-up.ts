import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AUTH_TOAST } from "../constants"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"
import type { SignUpValues } from "../schemas"

export function useSignUp() {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: AUTH_TOAST.SIGNED_UP },
    mutationFn: ({ name, email, password, workspace }: SignUpValues) =>
      authService.register({ name, email, password, workspaceName: workspace }),
    onSuccess: (session) => {
      if (session) queryClient.setQueryData(AUTH_QUERY_KEYS.session, session)
    },
  })
}
