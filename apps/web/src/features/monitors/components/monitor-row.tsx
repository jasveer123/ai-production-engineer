import Link from "next/link"
import { Badge, TableCell, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { KIND_LABEL, STATE_LABEL, STATE_VARIANT } from "../constants"
import type { Monitor } from "../schemas"
import { MonitorTarget } from "./monitor-target"

interface MonitorRowProps {
  monitor: Monitor
}

export function MonitorRow({ monitor }: MonitorRowProps) {
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
        {monitor.paused ? (
          <Badge variant="warning">Paused</Badge>
        ) : (
          <Badge variant={STATE_VARIANT[monitor.state as keyof typeof STATE_VARIANT] ?? "default"}>
            {STATE_LABEL[monitor.state] ?? monitor.state}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {KIND_LABEL[monitor.kind] ?? monitor.kind}
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {monitor.uptime24h === null
          ? "-"
          : `${monitor.uptime24h.toFixed(monitor.uptime24h === 100 ? 0 : 2)}%`}
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {monitor.lastResponseMs === null ? "-" : `${monitor.lastResponseMs} ms`}
      </TableCell>
      <TableCell className="text-muted-foreground">
        every{" "}
        {monitor.intervalSeconds >= 60
          ? `${Math.round(monitor.intervalSeconds / 60)} min`
          : `${monitor.intervalSeconds}s`}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {monitor.lastCheckedAt ? formatRelativeTime(monitor.lastCheckedAt) : "-"}
      </TableCell>
    </TableRow>
  )
}
