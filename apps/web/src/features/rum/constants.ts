export const RUM_POLL_MS = 30_000

export const RANGES = [
  { minutes: 60, label: "Last hour" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 10080, label: "7 days" },
  { minutes: 43200, label: "30 days" },
] as const

export const VITAL_LIMITS: Record<
  string,
  { good: number; poor: number; unit: string; label: string }
> = {
  LCP: { good: 2500, poor: 4000, unit: "ms", label: "Largest paint" },
  FCP: { good: 1800, poor: 3000, unit: "ms", label: "First paint" },
  INP: { good: 200, poor: 500, unit: "ms", label: "Responsiveness" },
  CLS: { good: 0.1, poor: 0.25, unit: "", label: "Layout shift" },
  TTFB: { good: 800, poor: 1800, unit: "ms", label: "Server response" },
}
