import { formatRelativeTime } from "@/lib/format/relative-time"
import { formatDuration, formatEvery, formatPercent } from "../format"
import type { MonitorDetail } from "../schemas"

interface MonitorFactsProps {
  monitor: MonitorDetail
  now: number
}

const expiry = (iso: string | null, days: number | null) =>
  days === null ? "Not checked" : iso ? new Date(iso).toLocaleDateString() : "Waiting for lookup"

export function MonitorFacts({ monitor, now }: MonitorFactsProps) {
  const facts: [string, string][] = [
    [
      monitor.state === "down" ? "Down for" : monitor.state === "up" ? "Up for" : "Waiting since",
      formatDuration((now - Date.parse(monitor.stateSince)) / 1000),
    ],
    [
      "Last checked",
      monitor.lastCheckedAt ? formatRelativeTime(monitor.lastCheckedAt, now) : "Never",
    ],
    ["Uptime, 24h", formatPercent(monitor.uptime24h)],
    ["Last response", monitor.lastResponseMs === null ? "-" : `${monitor.lastResponseMs} ms`],
    ["Checks every", formatEvery(monitor.intervalSeconds)],
    [
      "Confirmation / recovery",
      `${formatDuration(monitor.confirmationSeconds)} / ${formatDuration(monitor.recoverySeconds)}`,
    ],
    ["SSL certificate expires", expiry(monitor.sslExpiresAt, monitor.sslExpiryDays)],
    ["Domain expires", expiry(monitor.domainExpiresAt, monitor.domainExpiryDays)],
  ]
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {facts.map(([label, value]) => (
        <div key={label} className="grid gap-1">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
