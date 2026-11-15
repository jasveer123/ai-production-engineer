"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge, Button, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { KIND_LABEL, REGIONS, STATE_LABEL, STATE_VARIANT } from "../constants"
import { useMonitor } from "../hooks"
import { AvailabilityTable } from "./availability-table"
import { MonitorActions } from "./monitor-actions"
import { MonitorBadge } from "./monitor-badge"
import { MonitorFacts } from "./monitor-facts"
import { MonitorIncidents } from "./monitor-incidents"
import { MonitorTarget } from "./monitor-target"
import { RecentChecksTable } from "./recent-checks-table"
import { ResponseChart } from "./response-chart"

export function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const monitor = useMonitor(workspace?.id, id)

  if (isPending || (workspace && monitor.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null
  if (!monitor.data) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        This monitor was not found in your workspace.
      </p>
    )
  }

  const data = monitor.data
  const regions = REGIONS.filter((r) => data.regions.includes(r.value)).map((r) => r.label)

  return (
    <div className="grid min-w-0 gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={ROUTES.monitors} />}
      >
        <ArrowLeft /> All monitors
      </Button>
      <header className="grid gap-5 border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {data.paused ? (
                <Badge variant="warning">Paused</Badge>
              ) : (
                <Badge
                  variant={STATE_VARIANT[data.state as keyof typeof STATE_VARIANT] ?? "default"}
                >
                  {STATE_LABEL[data.state] ?? data.state}
                </Badge>
              )}
              {data.inMaintenance && <Badge variant="warning">In maintenance window</Badge>}
              <Badge>{KIND_LABEL[data.kind] ?? data.kind}</Badge>
            </div>
            <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
              {data.name}
            </h1>
            <p className="font-mono text-[0.8125rem] break-all text-muted-foreground">
              {data.kind === "status" || data.kind === "keyword" || data.kind === "http"
                ? `${data.method} `
                : ""}
              <MonitorTarget monitor={data} />
            </p>
          </div>
          {canManage && <MonitorActions workspaceId={workspace.id} monitor={data} />}
        </div>
        <MonitorFacts monitor={data} now={monitor.dataUpdatedAt} />
        {data.lastError && <p className="text-sm text-danger">Last error: {data.lastError}</p>}
        <p className="text-[0.8125rem] text-muted-foreground">
          Selected regions: {regions.join(", ")}. Checks actually ran from: {data.probeLocation}.
        </p>
      </header>
      <section className="grid gap-3 border border-line bg-panel p-5">
        <Eyebrow>Response time, last 24 hours</Eyebrow>
        <ResponseChart buckets={data.history} />
      </section>
      <section className="grid gap-3">
        <Eyebrow>Availability</Eyebrow>
        <AvailabilityTable rows={data.availability} />
        <p className="text-[0.8125rem] text-muted-foreground">
          Paused time and maintenance windows are left out. Today is counted from midnight UTC.
        </p>
      </section>
      <section className="grid gap-3">
        <Eyebrow>Incidents</Eyebrow>
        <MonitorIncidents incidents={data.incidents} />
      </section>
      <section className="grid gap-3">
        <Eyebrow>Recent checks</Eyebrow>
        <RecentChecksTable checks={data.recent} />
      </section>
      <section className="grid gap-3 border border-line bg-panel p-5">
        <Eyebrow>Status badge</Eyebrow>
        <MonitorBadge name={data.name} url={data.badgeUrl} />
      </section>
    </div>
  )
}
