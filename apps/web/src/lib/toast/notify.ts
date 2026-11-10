import { toast } from "sonner"
import { ApiError, getErrorMessage } from "@/lib/api"
import { TOAST_DURATION_MS } from "./constants"
import { DEFAULT_ERROR_TITLE, ERROR_TITLE } from "./error-titles"

export function notifySuccess(message: string, description?: string) {
  toast.success(message, { description, duration: TOAST_DURATION_MS.SUCCESS })
}

export function notifyError(error: unknown) {
  const title = error instanceof ApiError ? ERROR_TITLE[error.code] : undefined

  toast.error(title ?? DEFAULT_ERROR_TITLE, {
    description: getErrorMessage(error),
    duration: TOAST_DURATION_MS.ERROR,
  })
}
