"use client"

import * as React from "react"
import { StatusStrip, StorySteps } from "@/components/shared"
import { Button, Chip, CodeBlock, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { WINDOWS } from "../constants"
import { useDashboards, useDeleteDashboard, useMetricNames, useSaveDashboard } from "../hooks"
import { exportDashboard } from "../lib/export-dashboard"
import { DashboardDialog } from "./dashboard-dialog"
import { MetricAlertsPanel } from "./metric-alerts-panel"
import { VariableBar } from "./variable-bar"
import { WidgetCard } from "./widget-card"
import { WidgetDialog } from "./widget-dialog"

const OTLP_HINT = `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=<your API address>/v1/metrics
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <your ingest token>`

export function MetricsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const dashboards = useDashboards(workspace?.id)
  const names = useMetricNames(workspace?.id)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [minutes, setMinutes] = React.useState<number>(60)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const selected =
    dashboards.data?.find((item) => item.id === selectedId) ?? dashboards.data?.[0] ?? null
  const save = useSaveDashboard(workspace?.id ?? "", selected?.id ?? "")
  const remove = useDeleteDashboard(workspace?.id ?? "")

  if (isPending || (workspace && dashboards.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const canEdit = ACTOR_ROLES.includes(workspace.role)
  const metrics = names.data ?? []
  const extraFilters = (selected?.variables ?? [])
    .filter((v) => values[v.key])
    .map((v) => `${v.key}=${values[v.key]}`)
    .join(",")

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Metrics" />
      <StatusStrip
        tone={metrics.length === 0 ? "idle" : "ok"}
        headline={
          metrics.length === 0
            ? "No numbers are flowing in yet"
            : `${metrics.length} metric${metrics.length === 1 ? " is" : "s are"} being tracked`
        }
        detail={
          metrics.length === 0
            ? "Point any OpenTelemetry SDK or collector at your workspace. CPU, queue depth and request counts appear here."
            : "Chart them on a dashboard, then alert when a number crosses a line."
        }
        stats={[
          { label: "Metrics", value: metrics.length },
          { label: "Dashboards", value: (dashboards.data ?? []).length },
          { label: "Charts on this board", value: selected?.widgets.length ?? 0 },
          { label: "Window", value: WINDOWS.find((w) => w.minutes === minutes)?.label ?? "-" },
        ]}
      />
      {metrics.length === 0 && (
        <>
          <StorySteps
            heading="Get your first metric in"
            steps={[
              {
                title: "Copy two settings",
                text: "An endpoint and your ingest token, shown below.",
              },
              {
                title: "Restart your app",
                text: "Any OpenTelemetry SDK or collector will start sending.",
              },
              {
                title: "Chart it",
                text: "Names appear here within a minute. Add them to a dashboard.",
              },
            ]}
          />
          <CodeBlock>{OTLP_HINT}</CodeBlock>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(dashboards.data ?? []).map((item) => (
            <Chip
              key={item.id}
              selected={selected?.id === item.id}
              onClick={() => {
                setSelectedId(item.id)
                setValues({})
              }}
            >
              {item.name}
            </Chip>
          ))}
          {canEdit && <DashboardDialog workspaceId={workspace.id} onCreated={setSelectedId} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((item) => (
            <Chip
              key={item.minutes}
              selected={minutes === item.minutes}
              onClick={() => setMinutes(item.minutes)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      {!selected ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          Create a dashboard to start charting your metrics.
        </p>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <WidgetDialog
                workspaceId={workspace.id}
                metrics={metrics}
                pending={save.isPending}
                onAdd={(widget) => save.mutate({ widgets: [...selected.widgets, widget] })}
              />
              <Button size="sm" variant="outline" onClick={() => exportDashboard(selected)}>
                Export JSON
              </Button>
              <ConfirmDialog
                triggerLabel="Delete dashboard"
                title={`Delete ${selected.name}?`}
                description="The charts on it are removed. Your metric data is kept."
                confirmLabel="Delete dashboard"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(selected.id)}
              />
            </div>
          )}
          <VariableBar
            workspaceId={workspace.id}
            metric={metrics.find((m) => m.name === selected.widgets[0]?.metric)}
            variables={selected.variables}
            values={values}
            canEdit={canEdit}
            onSelect={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            onChangeVariables={(variables) => save.mutate({ variables })}
          />
          {selected.widgets.length === 0 ? (
            <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
              This dashboard has no charts yet.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {selected.widgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  workspaceId={workspace.id}
                  widget={widget}
                  minutes={minutes}
                  extraFilters={extraFilters}
                  canEdit={canEdit}
                  onRemove={(id) =>
                    save.mutate({ widgets: selected.widgets.filter((w) => w.id !== id) })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      <MetricAlertsPanel workspaceId={workspace.id} canEdit={canEdit} />
    </div>
  )
}
