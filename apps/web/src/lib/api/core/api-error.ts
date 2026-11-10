import { API_ERROR_CODE, API_ERROR_MESSAGE, HTTP_STATUS } from "../config"

export interface ApiErrorBody {
  code?: string
  message?: string
  details?: unknown
  correlationId?: string
}

interface ApiErrorInit {
  status: number
  body?: ApiErrorBody
  correlationId?: string | null
  skipAuthRedirect?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  readonly correlationId: string | null
  readonly skipAuthRedirect: boolean

  constructor({ status, body = {}, correlationId, skipAuthRedirect = false }: ApiErrorInit) {
    super(body.message ?? API_ERROR_MESSAGE.UNKNOWN)
    this.name = "ApiError"
    this.status = status
    this.code = body.code ?? API_ERROR_CODE.UNKNOWN
    this.details = body.details
    this.correlationId = body.correlationId ?? correlationId ?? null
    this.skipAuthRedirect = skipAuthRedirect
  }

  get isUnauthorized() {
    return this.status === HTTP_STATUS.UNAUTHORIZED
  }

  get isServerError() {
    return this.status >= HTTP_STATUS.SERVER_ERROR_MIN
  }

  get isNetworkError() {
    return this.code === API_ERROR_CODE.NETWORK || this.code === API_ERROR_CODE.TIMEOUT
  }
}
