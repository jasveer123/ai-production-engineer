import Link from "next/link"
import { Badge } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime } from "@/lib/format/relative-time"
import type { AlertView } from "../schemas"

interface SourceIncidentsProps {
  alerts: AlertView[]
}

export function SourceIncidents({ alerts }: SourceIncidentsProps) {
  if (alerts.length === 0)
    return <p className="text-sm text-muted-foreground">This heartbeat has not gone down yet.</p>
  return (
    <ul className="grid divide-y divide-line border border-line bg-panel">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="grid gap-0.5">
            {alert.incidentId ? (
              <Link
                href={ROUTES.incidentDetail(alert.incidentId)}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {alert.incidentTitle ?? alert.title}
              </Link>
            ) : (
              <span className="text-sm font-medium">{alert.title}</span>
            )}
            <span className="text-[0.8125rem] text-muted-foreground">{alert.description}</span>
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {formatDateTime(alert.firstFiredAt)}
              {alert.resolvedAt ? ` to ${formatDateTime(alert.resolvedAt)}` : ""}
            </span>
          </span>
          <Badge variant={alert.status === "firing" ? "destructive" : "success"}>
            {alert.status === "firing" ? "Down" : "Recovered"}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
