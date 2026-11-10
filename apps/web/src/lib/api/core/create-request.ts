import { DEFAULT_CREDENTIALS, DEFAULT_TIMEOUT_MS } from "../config"
import { buildUrl } from "./build-url"
import { send } from "./send"
import { toApiError } from "./to-api-error"
import type { ApiError } from "./api-error"
import type { HttpClientConfig, RequestFn, RequestInit } from "./types"

export function createRequest({
  baseUrl,
  interceptors,
  refreshSession,
}: HttpClientConfig): RequestFn {
  const canRefresh = (error: ApiError, init: RequestInit, hasRetried: boolean) =>
    Boolean(refreshSession) && error.isUnauthorized && !init.skipAuthRefresh && !hasRetried

  async function execute<T>(init: RequestInit, hasRetried: boolean): Promise<T> {
    let config = {
      ...init,
      url: buildUrl(baseUrl, init.url, init.query),
      headers: { ...init.headers },
      timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      credentials: DEFAULT_CREDENTIALS,
    }

    try {
      for (const intercept of interceptors.request) config = await intercept(config)

      let response = await send(config)
      for (const intercept of interceptors.response) response = await intercept(response)

      return response.data as T
    } catch (caught) {
      let error = toApiError(caught)

      if (canRefresh(error, init, hasRetried)) {
        const refreshed = await refreshSession!().then(
          () => true,
          () => false
        )
        if (refreshed) return execute<T>(init, true)
      }

      for (const intercept of interceptors.error) error = await intercept(error)
      throw error
    }
  }

  return <T>(init: RequestInit) => execute<T>(init, false)
}
