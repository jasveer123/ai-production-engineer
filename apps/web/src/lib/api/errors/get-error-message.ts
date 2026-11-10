import { API_ERROR_MESSAGE } from "../config"
import { ApiError } from "../core"

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.isServerError && error.correlationId
      ? `${error.message} (${API_ERROR_MESSAGE.REFERENCE} ${error.correlationId})`
      : error.message
  }

  if (error instanceof Error) return error.message

  return API_ERROR_MESSAGE.UNKNOWN
}
