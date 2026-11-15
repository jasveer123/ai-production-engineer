export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60
    ? `${minutes}m ${seconds % 60}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function whoIs(s: {
  userName: string | null
  userEmail: string | null
  userId: string | null
}) {
  return s.userName ?? s.userEmail ?? s.userId ?? "Anonymous"
}

export function pathOf(url: string | null): string {
  if (!url) return "—"
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

export function formatVital(name: string, value: number | null): string {
  if (value === null || value === undefined) return "—"
  if (name === "CLS") return (Math.round(value * 1000) / 1000).toString()
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
}
