"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { CLOSED_STATUSES, type StatusFilter } from "../constants"
import { useIncidents } from "../hooks"
import { IncidentFilters } from "./incident-filters"
import { IncidentKpis } from "./incident-kpis"
import { IncidentsTable } from "./incidents-table"

export function IncidentsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const incidents = useIncidents(workspace?.id, "all", "")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("open")
  const [severity, setSeverity] = React.useState("")

  const all = React.useMemo(() => incidents.data ?? [], [incidents.data])
  const term = search.trim().toLowerCase()
  const visible = all.filter(
    (item) =>
      (status === "all" || (status === "closed") === CLOSED_STATUSES.includes(item.status)) &&
      (!severity || item.severity === severity) &&
      (!term || `${item.title} ${item.serviceName ?? ""}`.toLowerCase().includes(term))
  )

  if (isPending || (workspace && incidents.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Incidents" />
      <IncidentKpis incidents={all} />
      <IncidentFilters
        search={search}
        status={status}
        severity={severity}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onSeverityChange={setSeverity}
      />
      {visible.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          {all.length === 0
            ? "No incidents yet. When logs show a new problem, Pramaan opens one here and starts investigating."
            : "No incident matches these filters."}
        </p>
      ) : (
        <IncidentsTable incidents={visible} />
      )}
    </div>
  )
}
