"use client"

import { X } from "lucide-react"
import { Badge, Button, Spinner } from "@/components/ui"
import { AGGS } from "../constants"
import { useMetricSeries } from "../hooks"
import type { Widget } from "../schemas"
import { MetricAlertDrawer } from "./metric-alert-drawer"
import { WidgetBody } from "./widget-body"

interface WidgetCardProps {
  workspaceId: string
  widget: Widget
  minutes: number
  extraFilters: string
  canEdit: boolean
  onRemove: (id: string) => void
}

export function WidgetCard({
  workspaceId,
  widget,
  minutes,
  extraFilters,
  canEdit,
  onRemove,
}: WidgetCardProps) {
  const filters = [widget.filters, extraFilters].filter(Boolean).join(",")
  const series = useMetricSeries(workspaceId, { ...widget, filters }, minutes)
  const agg = AGGS.find((item) => item.value === widget.agg)?.label ?? widget.agg

  return (
    <article className="grid gap-3 border border-line bg-panel p-4" aria-label={widget.title}>
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold">{widget.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[0.75rem] text-muted-foreground">{widget.metric}</span>
            <Badge>{agg}</Badge>
            {widget.service && <Badge>{widget.service}</Badge>}
            {widget.groupBy && <Badge>by {widget.groupBy}</Badge>}
            {filters && <Badge>{filters}</Badge>}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <MetricAlertDrawer workspaceId={workspaceId} widget={{ ...widget, filters }} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${widget.title}`}
              onClick={() => onRemove(widget.id)}
            >
              <X />
            </Button>
          </div>
        )}
      </div>
      {series.isPending ? (
        <div className="grid h-32 place-items-center">
          <Spinner />
        </div>
      ) : series.data ? (
        <WidgetBody series={series.data} chart={widget.chart} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Could not load this chart. It retries every 30 seconds.
        </p>
      )}
    </article>
  )
}
