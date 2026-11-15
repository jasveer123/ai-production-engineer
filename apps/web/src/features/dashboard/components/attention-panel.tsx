import Link from "next/link"
import {
  Badge,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { SEVERITY_VARIANT, STATUS_LABEL } from "@/features/incidents"
import type { Monitor } from "@/features/monitors"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"

interface AttentionIncident {
  id: string
  title: string
  severity: string
  status: string
  serviceName: string | null
  firstSeenAt: string
}

interface AttentionPanelProps {
  incidents: AttentionIncident[]
  downMonitors: Monitor[]
}

export function AttentionPanel({ incidents, downMonitors }: AttentionPanelProps) {
  const total = incidents.length + downMonitors.length

  return (
    <section aria-label="Needs attention" className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <span className="text-xs text-muted-foreground">{total} open</span>
      </div>
      {total === 0 ? (
        <p className="border border-line bg-panel px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
          Nothing needs you. Incidents and monitors that fail will appear here.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell className="max-w-md">
                  <Link
                    href={ROUTES.incidentDetail(incident.id)}
                    className="block truncate font-medium outline-none hover:text-brand focus-visible:text-brand"
                  >
                    {incident.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      SEVERITY_VARIANT[incident.severity as keyof typeof SEVERITY_VARIANT] ??
                      "default"
                    }
                  >
                    {incident.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {STATUS_LABEL[incident.status] ?? incident.status}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {incident.serviceName ?? "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(incident.firstSeenAt)}
                </TableCell>
              </TableRow>
            ))}
            {downMonitors.map((monitor) => (
              <TableRow key={monitor.id}>
                <TableCell className="max-w-md">
                  <Link
                    href={ROUTES.monitorDetail(monitor.id)}
                    className="block truncate font-medium outline-none hover:text-brand focus-visible:text-brand"
                  >
                    {monitor.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Status state="failed">Monitor down</Status>
                </TableCell>
                <TableCell className="text-muted-foreground">Not answering</TableCell>
                <TableCell className="text-muted-foreground">-</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(monitor.stateSince)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
