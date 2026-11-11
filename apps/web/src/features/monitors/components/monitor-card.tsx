import Link from "next/link"
import { Badge } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import { KIND_LABEL, STATE_LABEL, STATE_VARIANT } from "../constants"
import type { Monitor } from "../schemas"
import { MonitorTarget } from "./monitor-target"

interface MonitorCardProps {
  monitor: Monitor
}

function every(seconds: number) {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`
}

export function MonitorCard({ monitor }: MonitorCardProps) {
  const down = !monitor.paused && monitor.state === "down"
  const uptime = monitor.uptime24h

  return (
    <Link
      href={ROUTES.monitorDetail(monitor.id)}
      className={cn(
        "grid content-start gap-4 border border-l-4 bg-panel p-4 outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40",
        down
          ? "border-line border-l-danger"
          : monitor.paused
            ? "border-line border-l-warn"
            : "border-line border-l-ok"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium">{monitor.name}</span>
          <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
            <MonitorTarget monitor={monitor} />
          </span>
        </div>
        {monitor.paused ? (
          <Badge variant="warning">Paused</Badge>
        ) : (
          <Badge variant={STATE_VARIANT[monitor.state as keyof typeof STATE_VARIANT] ?? "default"}>
            {STATE_LABEL[monitor.state] ?? monitor.state}
          </Badge>
        )}
      </div>
      <div className="h-1.5 w-full bg-sunken" aria-hidden>
        <div
          className={cn("h-full", down ? "bg-danger" : "bg-ok")}
          style={{ width: `${uptime ?? 0}%` }}
        />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[0.8125rem]">
        <div className="grid">
          <dt className="text-[0.6875rem] text-muted-foreground">Uptime, 24h</dt>
          <dd className="font-mono">
            {uptime === null ? "-" : `${uptime.toFixed(uptime === 100 ? 0 : 2)}%`}
          </dd>
        </div>
        <div className="grid">
          <dt className="text-[0.6875rem] text-muted-foreground">Response</dt>
          <dd className="font-mono">
            {monitor.lastResponseMs === null ? "-" : `${monitor.lastResponseMs} ms`}
          </dd>
        </div>
        <div className="grid">
          <dt className="text-[0.6875rem] text-muted-foreground">Checks</dt>
          <dd>
            {KIND_LABEL[monitor.kind] ?? monitor.kind}, every {every(monitor.intervalSeconds)}
          </dd>
        </div>
      </dl>
      <p className="text-[0.75rem] text-muted-foreground">
        {down && monitor.lastError ? `${monitor.lastError} · ` : ""}
        {monitor.lastCheckedAt
          ? `Checked ${formatRelativeTime(monitor.lastCheckedAt)}`
          : "Not checked yet"}
        {down ? ` · down since ${formatRelativeTime(monitor.stateSince)}` : ""}
      </p>
    </Link>
  )
}
