import Link from "next/link"
import { TableCell, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { Incident } from "../schemas"
import { IncidentStatusBadge } from "./incident-status-badge"
import { SeverityBadge } from "./severity-badge"

interface IncidentRowProps {
  incident: Incident
}

export function IncidentRow({ incident }: IncidentRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Link
          href={ROUTES.incidentDetail(incident.id)}
          className="grid gap-0.5 outline-none hover:text-brand focus-visible:text-brand"
        >
          <span className="font-medium">{incident.title}</span>
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            {incident.source}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <SeverityBadge severity={incident.severity} />
      </TableCell>
      <TableCell>
        <IncidentStatusBadge status={incident.status} />
      </TableCell>
      <TableCell>
        {incident.serviceName ? (
          <span className="grid gap-0.5">
            <span>{incident.serviceName}</span>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">
              {incident.environment}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {incident.eventCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelativeTime(incident.firstSeenAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelativeTime(incident.lastSeenAt)}
      </TableCell>
    </TableRow>
  )
}
