import { API_BASE_URL } from "../config"
import { AUTH_ENDPOINTS } from "../endpoints"
import { createHttpClient } from "../core/create-http-client"
import { correlationId, jsonHeaders } from "../interceptors/request"

const refreshClient = createHttpClient({
  baseUrl: API_BASE_URL,
  interceptors: { request: [jsonHeaders, correlationId], response: [], error: [] },
})

let inflight: Promise<void> | null = null

export function refreshSession(): Promise<void> {
  inflight ??= refreshClient
    .post<void>(AUTH_ENDPOINTS.REFRESH, undefined, {
      skipAuthRefresh: true,
      skipAuthRedirect: true,
    })
    .then(() => undefined)
    .finally(() => {
      inflight = null
    })

  return inflight
}
