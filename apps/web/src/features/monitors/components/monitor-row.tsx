import Link from "next/link"
import { Status, TableCell, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { KIND_LABEL } from "../constants"
import type { Monitor } from "../schemas"
import { MonitorTarget } from "./monitor-target"

interface MonitorRowProps {
  monitor: Monitor
}

function every(seconds: number) {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`
}

export function MonitorRow({ monitor }: MonitorRowProps) {
  const down = !monitor.paused && monitor.state === "down"
  const uptime = monitor.uptime24h
  const state = monitor.paused
    ? { tone: "waiting" as const, label: "Paused" }
    : down
      ? { tone: "failed" as const, label: "Down" }
      : monitor.state === "up"
        ? { tone: "live" as const, label: "Up" }
        : { tone: "idle" as const, label: "Waiting" }

  return (
    <TableRow>
      <TableCell>
        <Link
          href={ROUTES.monitorDetail(monitor.id)}
          className="grid gap-0.5 outline-none hover:text-brand focus-visible:text-brand"
        >
          <span className="font-medium">{monitor.name}</span>
          <span className="max-w-xs truncate font-mono text-[0.6875rem] text-muted-foreground">
            <MonitorTarget monitor={monitor} />
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <Status state={state.tone}>{state.label}</Status>
        {down && (
          <span className="block text-[0.6875rem] text-muted-foreground">
            since {formatRelativeTime(monitor.stateSince)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="h-1 w-16 bg-sunken" aria-hidden>
            <span
              className={down ? "block h-full bg-danger" : "block h-full bg-ok"}
              style={{ width: `${uptime ?? 0}%` }}
            />
          </span>
          <span className="font-mono text-muted-foreground">
            {uptime === null ? "-" : `${uptime.toFixed(uptime === 100 ? 0 : 2)}%`}
          </span>
        </span>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {monitor.lastResponseMs === null ? "-" : `${monitor.lastResponseMs} ms`}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {KIND_LABEL[monitor.kind] ?? monitor.kind}, every {every(monitor.intervalSeconds)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {monitor.lastCheckedAt ? formatRelativeTime(monitor.lastCheckedAt) : "-"}
      </TableCell>
    </TableRow>
  )
}
