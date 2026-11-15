export function formatDuration(ms: number | null): string {
  if (ms === null) return "-"
  if (ms < 1000) return `${ms} ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "-"
}

export function formatSpan(seconds: number | null): string {
  if (seconds === null) return "-"
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function incidentLength(startIso: string, endIso: string | null, now = Date.now()) {
  const end = endIso ? new Date(endIso).getTime() : now
  return formatSpan(Math.max(0, (end - new Date(startIso).getTime()) / 1000))
}
