import { UPSTREAM_API_URL } from "./env"

const DOT_SEGMENTS = new Set([".", ".."])

export function buildUpstreamUrl(segments: string[], search: string): string | null {
  if (segments.length === 0 || segments.some((segment) => DOT_SEGMENTS.has(segment))) return null

  const path = segments.map(encodeURIComponent).join("/")
  return `${UPSTREAM_API_URL}/${path}${search}`
}
