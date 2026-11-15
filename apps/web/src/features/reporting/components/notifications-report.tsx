"use client"

import { Button, Spinner } from "@/components/ui"
import { useNotificationsReport } from "../hooks/use-reports"
import { downloadCsv } from "../lib/csv"
import type { ReportFilters } from "../schemas"

interface NotificationsReportProps {
  workspaceId: string
  filters: ReportFilters
}

export function NotificationsReport({ workspaceId, filters }: NotificationsReportProps) {
  const report = useNotificationsReport(workspaceId, filters)
  const rows = report.data ?? []

  if (report.isPending) return <Spinner />
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No notifications were sent in this range.</p>
    )

  const byChannel = Object.entries(
    rows.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.channel]: (acc[r.channel] ?? 0) + r.count }),
      {}
    )
  ).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...byChannel.map(([, n]) => n))

  return (
    <div className="grid gap-4">
      <Button
        size="sm"
        variant="outline"
        className="w-fit justify-self-end"
        onClick={() =>
          downloadCsv(
            `notifications-${filters.from}-${filters.to}.csv`,
            ["channel", "status", "count"],
            rows.map((r) => [r.channel, r.status, r.count])
          )
        }
      >
        Export CSV
      </Button>
      <ul className="grid gap-3" aria-label="Notifications by channel">
        {byChannel.map(([channel, total]) => (
          <li key={channel} className="grid gap-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{channel}</span>
              <span className="font-mono">{total}</span>
            </div>
            <span className="block h-2 bg-brand/70" style={{ width: `${(total / max) * 100}%` }} />
            <span className="text-[0.75rem] text-muted-foreground">
              {rows
                .filter((r) => r.channel === channel)
                .map((r) => `${r.count} ${r.status}`)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
