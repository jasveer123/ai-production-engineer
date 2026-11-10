import { DROPPED_RESPONSE_HEADERS } from "./constants"
import { rewriteSetCookie } from "./rewrite-set-cookie"

export function buildDownstreamResponse(upstream: Response): Response {
  const headers = new Headers()

  upstream.headers.forEach((value, name) => {
    if (!(DROPPED_RESPONSE_HEADERS as readonly string[]).includes(name)) headers.set(name, value)
  })
  upstream.headers.getSetCookie().forEach((cookie) => {
    headers.append("set-cookie", rewriteSetCookie(cookie))
  })

  return new Response(upstream.body, { status: upstream.status, headers })
}
