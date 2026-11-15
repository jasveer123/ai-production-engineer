import Link from "next/link"
import { Badge } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime } from "@/lib/format/relative-time"
import type { MonitorIncident } from "../schemas"

interface MonitorIncidentsProps {
  incidents: MonitorIncident[]
}

export function MonitorIncidents({ incidents }: MonitorIncidentsProps) {
  if (incidents.length === 0)
    return <p className="text-sm text-muted-foreground">This monitor has not opened an incident.</p>
  return (
    <ul className="grid divide-y divide-line border border-line bg-panel">
      {incidents.map((incident) => (
        <li key={incident.id}>
          <Link
            href={ROUTES.incidentDetail(incident.id)}
            className="flex flex-wrap items-center justify-between gap-2 p-3 outline-none hover:bg-panel-2 focus-visible:bg-panel-2"
          >
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{incident.title}</span>
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {formatDateTime(incident.startedAt)}
              </span>
            </span>
            <Badge>{incident.status.replaceAll("_", " ")}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  )
}
