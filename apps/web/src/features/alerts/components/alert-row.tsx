import Link from "next/link"
import { Badge, TableCell, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { SEVERITY_VARIANT, type SeverityValue } from "@/features/incidents"
import { SOURCE_KIND_LABEL } from "../constants"
import type { AlertView } from "../schemas"

interface AlertRowProps {
  alert: AlertView
}

export function AlertRow({ alert }: AlertRowProps) {
  return (
    <TableRow>
      <TableCell>
        <span className="grid gap-0.5">
          <span className="font-medium">{alert.title}</span>
          {alert.description && (
            <span className="max-w-md truncate text-[0.75rem] text-muted-foreground">
              {alert.description}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={alert.status === "firing" ? "destructive" : "success"}>
          {alert.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={SEVERITY_VARIANT[alert.severity as SeverityValue] ?? "default"}>
          {alert.severity}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="grid gap-0.5">
          <span>{alert.sourceName}</span>
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            {SOURCE_KIND_LABEL[alert.sourceKind] ?? alert.sourceKind}
          </span>
        </span>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">{alert.occurrences}</TableCell>
      <TableCell>
        {alert.incidentId ? (
          <Link href={ROUTES.incidentDetail(alert.incidentId)} className="hover:text-brand">
            {alert.incidentTitle ?? "Open incident"}
          </Link>
        ) : (
          <span className="text-muted-foreground">{alert.routeName ? "Recorded only" : "-"}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelativeTime(alert.lastFiredAt)}
      </TableCell>
    </TableRow>
  )
}
