"use client"

import { X } from "lucide-react"
import { Badge, Button, Spinner } from "@/components/ui"
import { AGGS } from "../constants"
import { useMetricSeries } from "../hooks"
import type { Widget } from "../schemas"
import { MetricChart } from "./metric-chart"

interface WidgetCardProps {
  workspaceId: string
  widget: Widget
  minutes: number
  canEdit: boolean
  onRemove: (id: string) => void
}

export function WidgetCard({ workspaceId, widget, minutes, canEdit, onRemove }: WidgetCardProps) {
  const series = useMetricSeries(workspaceId, widget, minutes)
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
          </div>
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${widget.title}`}
            onClick={() => onRemove(widget.id)}
          >
            <X />
          </Button>
        )}
      </div>
      {series.isPending ? (
        <div className="grid h-32 place-items-center">
          <Spinner />
        </div>
      ) : series.data ? (
        <MetricChart series={series.data} />
      ) : (
        <p className="text-sm text-muted-foreground">Could not load this chart.</p>
      )}
    </article>
  )
}
