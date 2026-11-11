"use client"

import * as React from "react"
import { formatDateTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import type { Bucket } from "../schemas"

interface ResponseChartProps {
  buckets: Bucket[]
}

export function ResponseChart({ buckets }: ResponseChartProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((bucket) => bucket.avgMs ?? 0))
  const active = hovered === null ? null : buckets[hovered]
  const left = hovered === null ? 0 : ((hovered + 0.5) / buckets.length) * 100

  return (
    <div className="relative">
      <div
        role="img"
        aria-label="Response time over the last 24 hours"
        className="flex h-32 items-end gap-px border-b border-line"
        onMouseLeave={() => setHovered(null)}
      >
        {buckets.map((bucket, index) => {
          const failed = bucket.failures > 0
          const height = bucket.total === 0 ? 2 : Math.max(6, ((bucket.avgMs ?? 0) / max) * 100)

          return (
            <span
              key={bucket.at}
              className="flex h-full min-w-0 flex-1 cursor-crosshair items-end"
              onMouseEnter={() => setHovered(index)}
            >
              <span
                className={cn(
                  "block w-full",
                  bucket.total === 0 ? "bg-line" : failed ? "bg-danger" : "bg-brand/60",
                  hovered === index && !failed && bucket.total > 0 && "bg-brand"
                )}
                style={{ height: failed ? "100%" : `${height}%` }}
              />
            </span>
          )
        })}
      </div>
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute -top-2 z-10 grid w-52 -translate-x-1/2 -translate-y-full gap-1 border border-line-strong bg-panel p-3 text-[0.75rem] shadow-lg"
          style={{ left: `clamp(6.5rem, ${left}%, calc(100% - 6.5rem))` }}
        >
          <span className="font-mono text-muted-foreground">{formatDateTime(active.at)}</span>
          <span className="flex justify-between">
            <span>Checks</span>
            <span className="font-mono">{active.total}</span>
          </span>
          <span className="flex justify-between text-danger">
            <span>Failed</span>
            <span className="font-mono">{active.failures}</span>
          </span>
          <span className="flex justify-between text-muted-foreground">
            <span>Average response</span>
            <span className="font-mono">{active.avgMs === null ? "-" : `${active.avgMs} ms`}</span>
          </span>
        </div>
      )}
    </div>
  )
}
