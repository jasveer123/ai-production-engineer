"use client"

import { Badge, Button } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatDateTime } from "@/lib/format/relative-time"
import { ALERT_STATE_LABEL } from "../constants"
import {
  useCheckMetricAlert,
  useDeleteMetricAlert,
  useMetricAlerts,
  useUpdateMetricAlert,
} from "../hooks"
import type { MetricAlert } from "../schemas"

interface MetricAlertsPanelProps {
  workspaceId: string
  canEdit: boolean
}

const TONE: Record<
  MetricAlert["state"],
  "success" | "warning" | "destructive" | "default" | "info"
> = {
  ok: "success",
  pending: "warning",
  firing: "destructive",
  recovering: "info",
  no_data: "default",
  error: "destructive",
}

export function MetricAlertsPanel({ workspaceId, canEdit }: MetricAlertsPanelProps) {
  const alerts = useMetricAlerts(workspaceId)
  const update = useUpdateMetricAlert(workspaceId)
  const check = useCheckMetricAlert(workspaceId)
  const remove = useDeleteMetricAlert(workspaceId)
  const items = alerts.data ?? []

  return (
    <section className="grid gap-3" aria-labelledby="metric-alerts-heading">
      <h2 id="metric-alerts-heading" className="text-sm font-semibold">
        Metric alerts
      </h2>
      {alerts.isError && <p className="text-sm text-danger">Could not load metric alerts.</p>}
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
          No metric alerts yet. Use the bell on any chart to alert when it crosses a line, changes
          sharply or looks unusual.
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((alert) => (
            <li key={alert.id} className="grid gap-2 border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{alert.name}</span>
                  <Badge variant={TONE[alert.state]}>{ALERT_STATE_LABEL[alert.state]}</Badge>
                  {alert.paused && <Badge>Paused</Badge>}
                  <Badge>{alert.severity}</Badge>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={check.isPending}
                      onClick={() => check.mutate(alert.id)}
                    >
                      Check now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: alert.id, paused: !alert.paused })}
                    >
                      {alert.paused ? "Resume" : "Pause"}
                    </Button>
                    <ConfirmDialog
                      triggerLabel="Delete"
                      title={`Delete ${alert.name}?`}
                      description="Open alerts from this rule are resolved."
                      confirmLabel="Delete alert"
                      pending={remove.isPending}
                      onConfirm={() => remove.mutate(alert.id)}
                    />
                  </div>
                )}
              </div>
              <p className="font-mono text-[0.75rem] text-muted-foreground">
                {alert.query.agg}({alert.query.metric}) {alert.condition.type}{" "}
                {alert.condition.operator} {alert.condition.threshold} over {alert.windowMinutes}m,
                every {alert.everySeconds}s, no data: {alert.missingData}
              </p>
              {alert.lastError && (
                <p className="text-[0.8125rem] text-danger">Query error: {alert.lastError}</p>
              )}
              {alert.series.length > 0 && (
                <ul className="grid gap-1 text-[0.8125rem]">
                  {alert.series.map((s) => (
                    <li key={s.series} className="flex flex-wrap items-center gap-2">
                      <Badge variant={TONE[s.state]}>{ALERT_STATE_LABEL[s.state]}</Badge>
                      <span className="font-mono">
                        {s.series === "*" ? "whole query" : s.series}
                      </span>
                      <span className="text-muted-foreground">{s.observation}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[0.75rem] text-muted-foreground">
                {alert.lastEvaluatedAt
                  ? `Last checked ${formatDateTime(alert.lastEvaluatedAt)}`
                  : "Not checked yet"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
