export const HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
} as const

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD]

export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR_MIN: 500,
  NETWORK_FAILURE: 0,
} as const

export const HEADER = {
  ACCEPT: "accept",
  CONTENT_TYPE: "content-type",
  CORRELATION_ID: "x-correlation-id",
  COOKIE: "cookie",
} as const

export const CONTENT_TYPE = {
  JSON: "application/json",
} as const

export const DEFAULT_TIMEOUT_MS = 15_000

export const DEFAULT_CREDENTIALS: RequestCredentials = "include"

export const API_ERROR_CODE = {
  NETWORK: "network",
  TIMEOUT: "timeout",
  INVALID_RESPONSE: "invalid_response",
  UPSTREAM_UNAVAILABLE: "upstream_unavailable",
  FORBIDDEN_ORIGIN: "forbidden_origin",
  INVALID_TOKEN: "invalid_token",
  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_LOCKED: "account_locked",
  EMAIL_TAKEN: "email_taken",
  WEAK_PASSWORD: "weak_password",
  INVALID_LINK: "invalid_link",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  RATE_LIMITED: "rate_limited",
  VALIDATION_FAILED: "validation_failed",
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  UNKNOWN: "error",
} as const

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE]

export const API_ERROR_MESSAGE = {
  NETWORK: "Could not reach the server. Check your connection and try again.",
  TIMEOUT: "The server took too long to answer. Try again.",
  INVALID_RESPONSE: "The server sent an answer we could not read.",
  UNKNOWN: "Something went wrong. Try again.",
  REFERENCE: "reference",
} as const
