const SECOND_MS = 1_000
const MINUTE_S = 60
const HOUR_S = 3_600
const DAY_S = 86_400

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / SECOND_MS))

  if (seconds < 10) return "just now"
  if (seconds < MINUTE_S) return `${seconds}s ago`
  if (seconds < HOUR_S) return `${Math.floor(seconds / MINUTE_S)}m ago`
  if (seconds < DAY_S) return `${Math.floor(seconds / HOUR_S)}h ago`
  return `${Math.floor(seconds / DAY_S)}d ago`
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false })
}
