import { useMutation } from "@tanstack/react-query"
import { authService } from "../services"
import { AUTH_TOAST } from "../constants"

export function useResendVerification() {
  return useMutation({
    meta: { successMessage: AUTH_TOAST.VERIFICATION_SENT },
    mutationFn: authService.resendVerification,
  })
}
