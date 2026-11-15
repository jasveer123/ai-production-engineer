"use client"

import * as React from "react"
import { formatDateTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import { formatValue } from "../lib/format"
import type { MetricSeries } from "../schemas"

interface MetricChartProps {
  series: MetricSeries
}

export function MetricChart({ series }: MetricChartProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const { buckets, unit } = series
  const max = Math.max(0, ...buckets.map((b) => b.value ?? 0))
  const active = hovered === null ? null : buckets[hovered]
  const left = hovered === null ? 0 : ((hovered + 0.5) / buckets.length) * 100

  return (
    <div className="relative">
      <div
        role="img"
        aria-label={`${series.name} over time`}
        className="flex h-32 items-end gap-px border-b border-line"
        onMouseLeave={() => setHovered(null)}
      >
        {buckets.map((bucket, index) => {
          const height =
            bucket.value === null ? 2 : Math.max(4, max === 0 ? 4 : (bucket.value / max) * 100)

          return (
            <span
              key={bucket.at}
              className="flex h-full min-w-0 flex-1 cursor-crosshair items-end"
              onMouseEnter={() => setHovered(index)}
            >
              <span
                className={cn(
                  "block w-full",
                  bucket.value === null ? "bg-line" : "bg-brand/60",
                  hovered === index && bucket.value !== null && "bg-brand"
                )}
                style={{ height: `${height}%` }}
              />
            </span>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
        <span>0</span>
        <span>max {formatValue(max, unit)}</span>
      </div>
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute -top-2 z-10 grid w-48 -translate-x-1/2 -translate-y-full gap-1 border border-line-strong bg-panel p-3 text-[0.75rem] shadow-lg"
          style={{ left: `clamp(6rem, ${left}%, calc(100% - 6rem))` }}
        >
          <span className="font-mono text-muted-foreground">{formatDateTime(active.at)}</span>
          <span className="font-mono">
            {active.value === null ? "No data" : formatValue(active.value, unit)}
          </span>
        </div>
      )}
    </div>
  )
}
