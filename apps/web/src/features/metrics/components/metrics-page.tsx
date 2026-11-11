"use client"

import * as React from "react"
import { Chip, CodeBlock, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { WINDOWS } from "../constants"
import { useDashboards, useDeleteDashboard, useMetricNames, useSaveWidgets } from "../hooks"
import { DashboardDialog } from "./dashboard-dialog"
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
  const selected =
    dashboards.data?.find((item) => item.id === selectedId) ?? dashboards.data?.[0] ?? null
  const save = useSaveWidgets(workspace?.id ?? "", selected?.id ?? "")
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

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Metrics" />
      {metrics.length === 0 && (
        <section className="grid gap-2 border border-dashed border-line p-5">
          <p className="text-sm">
            No metrics yet. Point any OpenTelemetry SDK or collector at your workspace and numbers
            such as CPU, queue depth or request counts appear here.
          </p>
          <CodeBlock>{OTLP_HINT}</CodeBlock>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(dashboards.data ?? []).map((item) => (
            <Chip
              key={item.id}
              selected={selected?.id === item.id}
              onClick={() => setSelectedId(item.id)}
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
                metrics={metrics}
                pending={save.isPending}
                onAdd={(widget) => save.mutate([...selected.widgets, widget])}
              />
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
                  canEdit={canEdit}
                  onRemove={(id) => save.mutate(selected.widgets.filter((w) => w.id !== id))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
