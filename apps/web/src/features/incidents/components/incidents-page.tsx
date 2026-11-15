"use client"

import * as React from "react"
import { Button, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useMonitors } from "@/features/monitors"
import { useIncidentList, useIncidents } from "../hooks"
import type { IncidentListFilters } from "../response-schemas"
import { LIST_PAGE_SIZE } from "../services"
import { IncidentFilters } from "./incident-filters"
import { IncidentKpis } from "./incident-kpis"
import { IncidentsTable } from "./incidents-table"
import { ReportIncidentDrawer } from "./report-incident-drawer"

const INITIAL: IncidentListFilters = {
  state: "unresolved",
  severity: "",
  monitorId: "",
  q: "",
  from: "",
  to: "",
  offset: 0,
}

export function IncidentsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [filters, setFilters] = React.useState(INITIAL)
  const list = useIncidentList(workspace?.id, filters)
  const open = useIncidents(workspace?.id, "open", "")
  const monitorList = useMonitors(workspace?.id)
  const monitors = Object.fromEntries((monitorList.data ?? []).map((m) => [m.id, m.name]))
  const change = (patch: Partial<IncidentListFilters>) =>
    setFilters((current) => ({ ...current, offset: 0, ...patch }))

  if (isPending || (workspace && list.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const rows = list.data ?? []
  const page = filters.offset / LIST_PAGE_SIZE + 1

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading workspaceName={workspace.name} title="Incidents" />
        <ReportIncidentDrawer workspaceId={workspace.id} monitors={monitors} />
      </div>
      <IncidentKpis incidents={open.data ?? []} />
      <IncidentFilters filters={filters} monitors={monitors} onChange={change} />
      {rows.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          {filters.offset > 0
            ? "No more incidents on this page."
            : "No incident matches these filters. Report one by hand, or wait for a monitor or alert to open one."}
        </p>
      ) : (
        <IncidentsTable incidents={rows} />
      )}
      <nav aria-label="Pages" className="flex items-center justify-end gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">Page {page}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={filters.offset === 0}
          onClick={() =>
            setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - LIST_PAGE_SIZE) }))
          }
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length < LIST_PAGE_SIZE}
          onClick={() => setFilters((f) => ({ ...f, offset: f.offset + LIST_PAGE_SIZE }))}
        >
          Next
        </Button>
      </nav>
    </div>
  )
}
