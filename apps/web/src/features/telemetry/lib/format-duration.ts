export function formatDuration(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)} µs`
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}
