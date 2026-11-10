import { HTTP_METHOD } from "@/lib/api/config"
import { bffErrorResponse } from "./bff-error-response"
import { buildDownstreamResponse } from "./build-downstream-response"
import { buildUpstreamHeaders } from "./build-upstream-headers"
import { buildUpstreamUrl } from "./build-upstream-url"
import { BFF_ERROR, UPSTREAM_TIMEOUT_MS } from "./constants"
import { isSameOriginRequest } from "./is-same-origin-request"

const METHODS_WITHOUT_BODY: string[] = [HTTP_METHOD.GET, "HEAD"]

export async function proxyRequest(request: Request, segments: string[]): Promise<Response> {
  if (!isSameOriginRequest(request)) return bffErrorResponse(BFF_ERROR.FORBIDDEN_ORIGIN)

  const url = buildUpstreamUrl(segments, new URL(request.url).search)
  if (!url) return bffErrorResponse(BFF_ERROR.BAD_PATH)

  const hasBody = !METHODS_WITHOUT_BODY.includes(request.method)

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      ...(hasBody && { duplex: "half" }),
    })

    return buildDownstreamResponse(upstream)
  } catch {
    return bffErrorResponse(BFF_ERROR.UPSTREAM_UNAVAILABLE)
  }
}
