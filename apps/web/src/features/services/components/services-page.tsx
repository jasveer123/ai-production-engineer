"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading, useOpenIncidents } from "@/features/integrations"
import type { StatusFilter } from "../constants"
import { useBusinessImpact, useRegisteredServices, useServiceSummary } from "../hooks"
import { buildServiceRows } from "../lib"
import { ServicesFilters } from "./services-filters"
import { ServiceMapSection } from "./service-map-section"
import { ServicesKpis } from "./services-kpis"
import { ServicesTable } from "./services-table"

export function ServicesPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const summary = useServiceSummary(workspace?.id)
  const incidents = useOpenIncidents(workspace?.id, true)
  const registered = useRegisteredServices(workspace?.id)
  const impact = useBusinessImpact(workspace?.id)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [environment, setEnvironment] = React.useState("")

  const rows = React.useMemo(
    () =>
      buildServiceRows({
        summary: summary.data,
        incidents: incidents.data ?? [],
        registered: registered.data,
        impact: impact.data,
      }),
    [summary.data, incidents.data, registered.data, impact.data]
  )
  const environments = React.useMemo(
    () => [...new Set(rows.map((row) => row.environment))].sort(),
    [rows]
  )
  const visible = rows.filter(
    (row) =>
      (!search.trim() || row.name.toLowerCase().includes(search.trim().toLowerCase())) &&
      (status === "all" || row.status === status) &&
      (!environment || row.environment === environment)
  )

  if (isPending || (workspace && summary.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Services" />
      <ServicesKpis rows={rows} />
      <ServicesFilters
        search={search}
        status={status}
        environment={environment}
        environments={environments}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onEnvironmentChange={setEnvironment}
      />
      {visible.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No service has sent logs in the last 24 hours. Connect an integration to see it here."
            : "No service matches these filters."}
        </p>
      ) : (
        <ServicesTable workspaceId={workspace.id} rows={visible} canManage={canManage} />
      )}
      <ServiceMapSection workspaceId={workspace.id} />
    </div>
  )
}
