const MINUTE_MS = 60_000

export const STALE_TIME = {
  DEFAULT: MINUTE_MS,
  SESSION: 5 * MINUTE_MS,
} as const

export const QUERY_RETRY_COUNT = 1
