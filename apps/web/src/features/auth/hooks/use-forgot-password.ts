import { useMutation } from "@tanstack/react-query"
import { authService } from "../services"
import { AUTH_TOAST } from "../constants"

export function useForgotPassword() {
  return useMutation({
    meta: { successMessage: AUTH_TOAST.RESET_LINK_SENT },
    mutationFn: authService.forgotPassword,
  })
}
