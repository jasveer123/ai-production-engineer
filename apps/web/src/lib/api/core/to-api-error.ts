import { ZodError } from "zod"
import { API_ERROR_CODE, API_ERROR_MESSAGE, HTTP_STATUS } from "../config"
import { ApiError } from "./api-error"

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof ZodError) {
    return new ApiError({
      status: HTTP_STATUS.OK,
      body: {
        code: API_ERROR_CODE.INVALID_RESPONSE,
        message: API_ERROR_MESSAGE.INVALID_RESPONSE,
        details: error.issues,
      },
    })
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new ApiError({
      status: HTTP_STATUS.NETWORK_FAILURE,
      body: { code: API_ERROR_CODE.TIMEOUT, message: API_ERROR_MESSAGE.TIMEOUT },
    })
  }

  return new ApiError({
    status: HTTP_STATUS.NETWORK_FAILURE,
    body: { code: API_ERROR_CODE.NETWORK, message: API_ERROR_MESSAGE.NETWORK },
  })
}
