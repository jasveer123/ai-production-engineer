import "server-only"
import { UPSTREAM_API_URL } from "@/lib/bff/env"
import { createHttpClient } from "../core"
import { correlationId, jsonHeaders } from "../interceptors"
import { forwardCookies } from "../interceptors/request/forward-cookies"

export const serverHttp = createHttpClient({
  baseUrl: UPSTREAM_API_URL,
  interceptors: {
    request: [jsonHeaders, correlationId, forwardCookies],
    response: [],
    error: [],
  },
})
