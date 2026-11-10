import { API_ERROR_CODE } from "@/lib/api/config"

export const DEFAULT_ERROR_TITLE = "Something went wrong"

export const ERROR_TITLE: Record<string, string> = {
  [API_ERROR_CODE.NETWORK]: "You seem to be offline",
  [API_ERROR_CODE.TIMEOUT]: "The server is slow to answer",
  [API_ERROR_CODE.UPSTREAM_UNAVAILABLE]: "The server is not reachable",
  [API_ERROR_CODE.INVALID_RESPONSE]: "Unexpected answer from the server",
  [API_ERROR_CODE.FORBIDDEN_ORIGIN]: "Request blocked",
  [API_ERROR_CODE.INVALID_TOKEN]: "That token does not work",
  [API_ERROR_CODE.INVALID_CREDENTIALS]: "Could not sign you in",
  [API_ERROR_CODE.ACCOUNT_LOCKED]: "Account locked for now",
  [API_ERROR_CODE.EMAIL_TAKEN]: "That email is already in use",
  [API_ERROR_CODE.WEAK_PASSWORD]: "Choose a stronger password",
  [API_ERROR_CODE.INVALID_LINK]: "This link no longer works",
  [API_ERROR_CODE.EMAIL_NOT_VERIFIED]: "Confirm your email first",
  [API_ERROR_CODE.RATE_LIMITED]: "Too many attempts",
  [API_ERROR_CODE.VALIDATION_FAILED]: "Please check the form",
  [API_ERROR_CODE.UNAUTHENTICATED]: "Please sign in again",
  [API_ERROR_CODE.FORBIDDEN]: "You do not have permission",
  [API_ERROR_CODE.NOT_FOUND]: "Not found",
  [API_ERROR_CODE.CONFLICT]: "That conflicts with existing data",
}
