"use client"

import { Button, Spinner } from "@/components/ui"
import { StatusStrip } from "@/components/shared"
import { formatSpan } from "@/features/incidents"
import { useIncidentsReport } from "../hooks/use-reports"
import { downloadCsv } from "../lib/csv"
import type { ReportFilters } from "../schemas"
import { BarChart } from "./bar-chart"
import { HeatmapGrid } from "./heatmap-grid"

interface IncidentsOverviewProps {
  workspaceId: string
  filters: ReportFilters
}

export function IncidentsOverview({ workspaceId, filters }: IncidentsOverviewProps) {
  const report = useIncidentsReport(workspaceId, filters)
  const data = report.data

  if (report.isPending) return <Spinner />
  if (!data)
    return <p className="text-sm text-muted-foreground">This report could not be loaded.</p>

  const share =
    data.acknowledgedShare === null ? "-" : `${Math.round(data.acknowledgedShare * 100)}%`
  const exportCsv = () =>
    downloadCsv(
      `incidents-${filters.from}-${filters.to}.csv`,
      [
        "id",
        "title",
        "severity",
        "monitor",
        "started",
        "acknowledged",
        "acknowledged by",
        "resolved",
        "resolved by",
        "origin",
      ],
      data.incidents.map((i) => [
        i.id,
        i.title,
        i.severity,
        i.monitorName,
        i.startedAt,
        i.acknowledgedAt,
        i.acknowledgedBy,
        i.resolvedAt,
        i.resolvedBy,
        i.resolutionOrigin,
      ])
    )

  return (
    <div className="grid gap-6">
      <StatusStrip
        tone={data.unresolved > 0 ? "warn" : "ok"}
        headline={`${data.started} incident${data.started === 1 ? "" : "s"} started, ${data.resolved} resolved`}
        detail={`MTTA uses ${data.acknowledged} acknowledged incidents (${data.unacknowledged} never acknowledged are left out). MTTR uses resolved incidents with a recorded time (${data.unresolved} unresolved, ${data.missingTimestamps} without a time are left out).${data.truncated ? " Only the first 5000 incidents are counted." : ""}`}
        stats={[
          { label: "MTTA", value: formatSpan(data.mttaSeconds) },
          { label: "MTTR", value: formatSpan(data.mttrSeconds) },
          { label: "Acknowledged", value: share },
          { label: "Unresolved", value: data.unresolved },
        ]}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={data.incidents.length === 0}
          >
            Export CSV
          </Button>
        }
      />
      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-semibold">Started and resolved per day</h2>
        <BarChart
          title="Incidents started and resolved per day"
          labels={data.daily.map((d) => d.day)}
          series={[
            { label: "Started", tone: "danger", values: data.daily.map((d) => d.started) },
            { label: "Resolved", tone: "ok", values: data.daily.map((d) => d.resolved) },
          ]}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-semibold">When incidents start</h2>
        <HeatmapGrid grid={data.heatmap} />
      </section>
    </div>
  )
}
