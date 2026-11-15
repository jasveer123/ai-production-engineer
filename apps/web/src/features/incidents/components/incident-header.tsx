import { Eyebrow } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { incidentLength } from "../lib"
import type { Incident, Person } from "../schemas"
import { IncidentActions } from "./incident-actions"
import { IncidentStatusBadge } from "./incident-status-badge"
import { ResponseActions } from "./response-actions"
import { ResponseStateBadge } from "./response-state-badge"
import { SeverityBadge } from "./severity-badge"
import { StatusFlow } from "./status-flow"

interface IncidentHeaderProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
  canRemove: boolean
}

const who = (person: Person | null) => (person ? (person.name ?? person.email) : null)

export function IncidentHeader({ workspaceId, incident, canAct, canRemove }: IncidentHeaderProps) {
  const resolved = incident.responseState === "resolved"
  const facts = [
    `Started ${formatDateTime(incident.firstSeenAt)}`,
    `${resolved ? "Lasted" : "Ongoing for"} ${incidentLength(incident.firstSeenAt, incident.resolvedAt)}`,
    incident.acknowledgedAt &&
      `Acknowledged ${formatDateTime(incident.acknowledgedAt)}${who(incident.acknowledgedBy) ? ` by ${who(incident.acknowledgedBy)}` : ""}`,
    resolved &&
      incident.resolvedAt &&
      `Resolved ${formatDateTime(incident.resolvedAt)} ${who(incident.resolvedBy) ? `by ${who(incident.resolvedBy)}` : `(${incident.resolutionOrigin ?? "automatic"})`}`,
  ].filter(Boolean)

  return (
    <header className="grid gap-5 border border-line bg-panel p-5">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ResponseStateBadge state={incident.responseState} />
          <SeverityBadge severity={incident.severity} />
          <span className="font-mono text-[0.75rem] text-muted-foreground">{incident.source}</span>
        </div>
        <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
          {incident.title}
        </h1>
        <p className="text-[0.8125rem] text-muted-foreground">{facts.join(" · ")}</p>
        {incident.resolutionReason && (
          <p className="text-sm">Resolution: {incident.resolutionReason}</p>
        )}
        <ResponseActions
          workspaceId={workspaceId}
          incident={incident}
          canAct={canAct}
          canRemove={canRemove}
        />
      </div>
      <div className="grid gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eyebrow>AI repair</Eyebrow>
            <IncidentStatusBadge status={incident.status} />
          </div>
          <IncidentActions workspaceId={workspaceId} incident={incident} canAct={canAct} />
        </div>
        <StatusFlow status={incident.status} />
      </div>
    </header>
  )
}
