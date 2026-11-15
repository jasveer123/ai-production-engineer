import Link from "next/link"
import { TableCell, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime } from "@/lib/format/relative-time"
import { incidentLength } from "../lib"
import type { Incident } from "../schemas"
import { ResponseStateBadge } from "./response-state-badge"
import { SeverityBadge } from "./severity-badge"

interface IncidentRowProps {
  incident: Incident
}

export function IncidentRow({ incident }: IncidentRowProps) {
  const ongoing = incident.responseState !== "resolved"
  return (
    <TableRow>
      <TableCell className="max-w-md">
        <Link
          href={ROUTES.incidentDetail(incident.id)}
          className="grid gap-0.5 outline-none hover:text-brand focus-visible:text-brand"
        >
          <span className="font-medium">{incident.title}</span>
          {incident.description && (
            <span className="truncate text-[0.75rem] text-muted-foreground">
              {incident.description}
            </span>
          )}
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            Started {formatDateTime(incident.firstSeenAt)} · {incident.source}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <ResponseStateBadge state={incident.responseState} />
      </TableCell>
      <TableCell>
        <SeverityBadge severity={incident.severity} />
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {ongoing ? "Ongoing · " : ""}
        {incidentLength(incident.firstSeenAt, incident.resolvedAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {incident.acknowledgedBy
          ? (incident.acknowledgedBy.name ?? incident.acknowledgedBy.email)
          : incident.acknowledgedAt
            ? "Yes"
            : "-"}
      </TableCell>
    </TableRow>
  )
}
