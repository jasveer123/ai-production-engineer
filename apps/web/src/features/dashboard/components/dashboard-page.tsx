"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import {
  PageHeading,
  SourceHealthTable,
  UsagePanel,
  summarizeUsage,
  useIngestOverview,
  useOpenIncidents,
  useUsage,
} from "@/features/integrations"
import { useMonitors } from "@/features/monitors"
import { useSchedules } from "@/features/oncall"
import { useStatusPages } from "@/features/status"
import { ROUTES } from "@/lib/constants/routes"
import { AttentionPanel } from "./attention-panel"
import { DashboardKpis } from "./dashboard-kpis"
import { SetupPath } from "./setup-path"

export function DashboardPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [live, setLive] = React.useState(true)
  const { data: overview } = useIngestOverview(workspace?.id, live)
  const usage = useUsage(workspace?.id, live)
  const incidents = useOpenIncidents(workspace?.id, live)
  const monitors = useMonitors(workspace?.id)
  const schedules = useSchedules(workspace?.id)
  const pages = useStatusPages(workspace?.id)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        You are not in a workspace yet. Ask an owner to invite you.
      </p>
    )
  }

  const open = incidents.data ?? []
  const watched = (monitors.data ?? []).filter((monitor) => !monitor.paused)
  const down = watched.filter((monitor) => monitor.state === "down")
  const waiting = open.filter((incident) => incident.status === "awaiting_review")
  const summary = usage.data ? summarizeUsage(usage.data.histogram) : undefined

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          title="Dashboard"
          description="What needs you, how your systems are doing, and what to set up next."
        />
        <Button variant="outline" size="sm" onClick={() => setLive((value) => !value)}>
          {live ? <Pause /> : <Play />} {live ? "Pause live data" : "Resume live data"}
        </Button>
      </div>
      <DashboardKpis
        items={[
          {
            label: "Open incidents",
            value: open.length,
            note: open.length ? `${waiting.length} waiting for your review` : "none open",
            hot: open.length > 0,
          },
          {
            label: "Monitors up",
            value: `${watched.length - down.length}/${watched.length}`,
            note: down.length ? down.map((monitor) => monitor.name).join(", ") : "all answering",
            hot: down.length > 0,
          },
          {
            label: "Logs per minute",
            value: summary ? Math.round(summary.perMinute).toLocaleString() : "-",
            note: summary
              ? `${summary.hourTotal.toLocaleString()} in the last hour`
              : "no data yet",
          },
          {
            label: "Errors, last hour",
            value: summary ? summary.hourErrors.toLocaleString() : "-",
            note: summary && summary.hourTotal ? "of all logs" : "no data yet",
            hot: (summary?.hourErrors ?? 0) > 0,
          },
        ]}
      />
      <AttentionPanel incidents={open} downMonitors={down} />
      <SetupPath
        steps={[
          {
            label: "Connect your app",
            href: ROUTES.integrations,
            done: overview?.ways.some((way) => way.state !== "not_set_up") ?? false,
          },
          { label: "Add a monitor", href: ROUTES.monitors, done: watched.length > 0 },
          {
            label: "Create an on-call schedule",
            href: ROUTES.oncall,
            done: (schedules.data ?? []).length > 0,
          },
          {
            label: "Publish a status page",
            href: ROUTES.statusPages,
            done: (pages.data ?? []).length > 0,
          },
        ]}
      />
      <div className="border border-line bg-panel p-4">
        <UsagePanel buckets={usage.data?.histogram} overview={overview} />
      </div>
      <SourceHealthTable overview={overview} />
    </div>
  )
}
