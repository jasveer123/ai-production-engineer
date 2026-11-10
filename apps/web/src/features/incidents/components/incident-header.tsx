import { formatRelativeTime } from "@/lib/format/relative-time"
import type { Incident } from "../schemas"
import { IncidentActions } from "./incident-actions"
import { IncidentStatusBadge } from "./incident-status-badge"
import { SeverityBadge } from "./severity-badge"
import { StatusFlow } from "./status-flow"

interface IncidentHeaderProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

export function IncidentHeader({ workspaceId, incident, canAct }: IncidentHeaderProps) {
  const meta = [
    incident.serviceName &&
      `${incident.serviceName} · ${incident.environment ?? "any environment"}`,
    incident.repositoryFullName,
    `${incident.eventCount.toLocaleString()} events`,
    `started ${formatRelativeTime(incident.firstSeenAt)}`,
    `last seen ${formatRelativeTime(incident.lastSeenAt)}`,
  ].filter(Boolean)

  return (
    <header className="grid gap-5 border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {incident.source}
            </span>
          </div>
          <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
            {incident.title}
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground">{meta.join(" · ")}</p>
          {incident.description && (
            <p className="max-w-3xl text-sm leading-6">{incident.description}</p>
          )}
        </div>
        <IncidentActions workspaceId={workspaceId} incident={incident} canAct={canAct} />
      </div>
      <StatusFlow status={incident.status} />
    </header>
  )
}
