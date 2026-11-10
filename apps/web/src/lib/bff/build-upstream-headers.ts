import { FORWARDED_FOR_HEADERS, FORWARDED_REQUEST_HEADERS } from "./constants"

export function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers()

  FORWARDED_REQUEST_HEADERS.forEach((name) => {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  })

  const forwardedFor = FORWARDED_FOR_HEADERS.map((name) => request.headers.get(name)).find(Boolean)
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor)

  return headers
}
