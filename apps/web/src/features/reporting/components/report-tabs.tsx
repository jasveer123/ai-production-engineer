"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useMemberOptions, usePolicyOptions } from "@/features/incidents"
import { useMonitors } from "@/features/monitors"
import type { ReportFilters as Filters } from "../schemas"
import { IncidentsOverview } from "./incidents-overview"
import { MonitorsReport } from "./monitors-report"
import { NotificationsReport } from "./notifications-report"
import { ReportFilters } from "./report-filters"
import { RespondersReport } from "./responders-report"

const day = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * 86_400_000).toLocaleDateString("en-CA")

const INITIAL: Filters = {
  from: day(29),
  to: day(0),
  monitorId: "",
  policyId: "",
  acknowledgedBy: "",
  resolvedBy: "",
  businessHours: false,
  weekdays: false,
}

interface ReportTabsProps {
  workspaceId: string
}

export function ReportTabs({ workspaceId }: ReportTabsProps) {
  const [filters, setFilters] = React.useState(INITIAL)
  const monitors = useMonitors(workspaceId)
  const policies = usePolicyOptions(workspaceId)
  const members = useMemberOptions(workspaceId)
  const toMap = <T,>(items: T[] | undefined, key: (t: T) => string, label: (t: T) => string) =>
    Object.fromEntries((items ?? []).map((t) => [key(t), label(t)]))

  return (
    <div className="grid gap-6">
      <ReportFilters
        filters={filters}
        monitors={toMap(
          monitors.data,
          (m) => m.id,
          (m) => m.name
        )}
        policies={toMap(
          policies.data,
          (p) => p.id,
          (p) => p.name
        )}
        people={toMap(
          members.data,
          (m) => m.userId,
          (m) => m.name ?? m.email
        )}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      />
      <Tabs defaultValue="incidents">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="monitors">Monitors</TabsTrigger>
          <TabsTrigger value="responders">Responders</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="incidents" className="pt-5">
          <IncidentsOverview workspaceId={workspaceId} filters={filters} />
        </TabsContent>
        <TabsContent value="monitors" className="pt-5">
          <MonitorsReport workspaceId={workspaceId} filters={filters} />
        </TabsContent>
        <TabsContent value="responders" className="pt-5">
          <RespondersReport workspaceId={workspaceId} filters={filters} />
        </TabsContent>
        <TabsContent value="notifications" className="pt-5">
          <NotificationsReport workspaceId={workspaceId} filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
