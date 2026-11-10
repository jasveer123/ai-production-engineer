export const API_PROXY_PREFIX = "/api"

export const UPSTREAM_TIMEOUT_MS = 30_000

export const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "cookie",
  "user-agent",
  "x-correlation-id",
  "x-ape-token",
] as const

export const FORWARDED_FOR_HEADERS = ["x-forwarded-for", "x-real-ip"] as const

export const DROPPED_RESPONSE_HEADERS = [
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "set-cookie",
  "transfer-encoding",
] as const

export const COOKIE_PATH_REWRITES: Record<string, string> = {
  "/auth": `${API_PROXY_PREFIX}/auth`,
}

export const BFF_ERROR = {
  FORBIDDEN_ORIGIN: {
    status: 403,
    code: "forbidden_origin",
    message: "This request did not come from this site.",
  },
  BAD_PATH: {
    status: 400,
    code: "bad_path",
    message: "That path is not allowed.",
  },
  UPSTREAM_UNAVAILABLE: {
    status: 502,
    code: "upstream_unavailable",
    message: "Could not reach the server. Check your connection and try again.",
  },
} as const

export type BffError = (typeof BFF_ERROR)[keyof typeof BFF_ERROR]
