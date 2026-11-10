import { HEADER, HTTP_METHOD, HTTP_STATUS } from "../config"
import { ApiError, type ApiErrorBody } from "./api-error"
import type { ApiResponse, RequestConfig } from "./types"

const METHODS_WITHOUT_BODY: string[] = [HTTP_METHOD.GET, HTTP_METHOD.DELETE]

function buildSignal(config: RequestConfig) {
  const timeout = AbortSignal.timeout(config.timeoutMs)
  return config.signal ? AbortSignal.any([config.signal, timeout]) : timeout
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === HTTP_STATUS.NO_CONTENT) return undefined
  return response.json().catch(() => null)
}

export async function send(config: RequestConfig): Promise<ApiResponse> {
  const hasBody = config.body !== undefined && !METHODS_WITHOUT_BODY.includes(config.method)

  const response = await fetch(config.url, {
    method: config.method,
    headers: config.headers,
    body: hasBody ? JSON.stringify(config.body) : undefined,
    credentials: config.credentials,
    cache: config.cache,
    signal: buildSignal(config),
  })

  const data = await readBody(response)

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      body: (data ?? {}) as ApiErrorBody,
      correlationId: response.headers.get(HEADER.CORRELATION_ID),
      skipAuthRedirect: config.skipAuthRedirect,
    })
  }

  return {
    data: config.schema ? config.schema.parse(data) : data,
    status: response.status,
    headers: response.headers,
    config,
  }
}
