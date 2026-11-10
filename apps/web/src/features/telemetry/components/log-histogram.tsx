"use client"

import * as React from "react"
import { formatDateTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import type { HistogramBucket } from "../schemas"

interface LogHistogramProps {
  buckets: HistogramBucket[]
  windowMs: number
}

const AXIS_POINTS = [0, 0.5, 1]

export function LogHistogram({ buckets, windowMs }: LogHistogramProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((bucket) => bucket.total))
  const bucketMs = buckets.length > 1 ? windowMs / buckets.length : windowMs
  const active = hovered === null ? null : buckets[hovered]
  const left = hovered === null ? 0 : ((hovered + 0.5) / buckets.length) * 100

  return (
    <div className="grid gap-1.5">
      <div className="flex gap-3">
        <div className="flex h-28 flex-col justify-between font-mono text-[0.6875rem] text-muted-foreground">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            role="img"
            aria-label="Logs over time"
            className="flex h-28 items-end gap-px border-b border-line"
            onMouseLeave={() => setHovered(null)}
          >
            {buckets.map((bucket, index) => {
              const height = bucket.total === 0 ? 2 : Math.max(4, (bucket.total / max) * 100)
              const errorShare = bucket.total ? (bucket.errors / bucket.total) * 100 : 0

              return (
                <span
                  key={bucket.at}
                  className="flex h-full min-w-0 flex-1 cursor-crosshair items-end"
                  onMouseEnter={() => setHovered(index)}
                >
                  <span
                    className={cn(
                      "relative block w-full overflow-hidden transition-colors",
                      bucket.total === 0 ? "bg-line" : "bg-brand/60",
                      hovered === index && bucket.total > 0 && "bg-brand"
                    )}
                    style={{ height: `${height}%` }}
                  >
                    {errorShare > 0 && (
                      <span
                        className="absolute inset-x-0 bottom-0 block bg-danger"
                        style={{ height: `${errorShare}%` }}
                      />
                    )}
                  </span>
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
              <span className="font-mono text-muted-foreground">
                {formatDateTime(active.at)} to{" "}
                {formatDateTime(new Date(new Date(active.at).getTime() + bucketMs).toISOString())}
              </span>
              <span className="flex justify-between">
                <span>Logs</span>
                <span className="font-mono">{active.total.toLocaleString()}</span>
              </span>
              <span className="flex justify-between text-danger">
                <span>Errors</span>
                <span className="font-mono">{active.errors.toLocaleString()}</span>
              </span>
              <span className="flex justify-between text-muted-foreground">
                <span>Error share</span>
                <span className="font-mono">
                  {active.total ? Math.round((active.errors / active.total) * 100) : 0}%
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between pl-9 font-mono text-[0.6875rem] text-muted-foreground">
        {AXIS_POINTS.map((point) => (
          <span key={point}>
            {buckets.length > 0
              ? formatDateTime(
                  new Date(
                    new Date(buckets[0]!.at).getTime() +
                      point * windowMs -
                      (point === 1 ? bucketMs : 0)
                  ).toISOString()
                ).replace(/:\d\d$/, "")
              : ""}
          </span>
        ))}
      </div>
    </div>
  )
}
