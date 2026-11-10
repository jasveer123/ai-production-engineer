import type { QueryParams } from "./types"

export function buildUrl(baseUrl: string, path: string, query?: QueryParams) {
  const origin = typeof window === "undefined" ? undefined : window.location.origin
  const url = new URL(`${baseUrl}${path}`, origin)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value))
  })

  return url.toString()
}
