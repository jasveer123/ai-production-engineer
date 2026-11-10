import { API_BASE_URL } from "../config"
import { createHttpClient } from "../core"
import { correlationId, jsonHeaders, redirectOnUnauthorized } from "../interceptors"
import { refreshSession } from "./refresh-session"

export const http = createHttpClient({
  baseUrl: API_BASE_URL,
  refreshSession,
  interceptors: {
    request: [jsonHeaders, correlationId],
    response: [],
    error: [redirectOnUnauthorized],
  },
})
