"use client"

import * as React from "react"
import { formatDateTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import { LEVEL_BAR, LEVEL_ORDER } from "../constants"
import type { LevelBucket } from "../explore-schemas"

interface LevelHistogramProps {
  buckets: LevelBucket[]
  bucketMs: number
  onSelect?: (from: string, to: string) => void
}

const levelsOf = (bucket: LevelBucket) => [
  ...LEVEL_ORDER.filter((level) => bucket.levels[level]),
  ...Object.keys(bucket.levels).filter(
    (level) => !(LEVEL_ORDER as readonly string[]).includes(level)
  ),
]

export function LevelHistogram({ buckets, bucketMs, onSelect }: LevelHistogramProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((bucket) => bucket.total))
  const active = hovered === null ? null : buckets[hovered]
  const end = (at: string) => new Date(new Date(at).getTime() + bucketMs).toISOString()

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <div
          role="img"
          aria-label="Log volume over time by level"
          className="flex h-28 items-end gap-px border-b border-line"
          onMouseLeave={() => setHovered(null)}
        >
          {buckets.map((bucket, index) => (
            <button
              type="button"
              key={bucket.at}
              aria-label={`${bucket.total} logs from ${formatDateTime(bucket.at)}`}
              className="flex h-full min-w-0 flex-1 cursor-zoom-in flex-col-reverse"
              onMouseEnter={() => setHovered(index)}
              onClick={() => bucket.total > 0 && onSelect?.(bucket.at, end(bucket.at))}
            >
              {bucket.total === 0 ? (
                <span className="block h-0.5 w-full bg-line" />
              ) : (
                levelsOf(bucket).map((level) => (
                  <span
                    key={level}
                    className={cn("block w-full", LEVEL_BAR[level] ?? "bg-brand/40")}
                    style={{ height: `${((bucket.levels[level] ?? 0) / max) * 100}%` }}
                  />
                ))
              )}
            </button>
          ))}
        </div>
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 left-1/2 z-10 grid w-56 -translate-x-1/2 -translate-y-full gap-1 border border-line-strong bg-panel p-3 text-[0.75rem] shadow-lg"
          >
            <span className="font-mono text-muted-foreground">
              {formatDateTime(active.at)} to {formatDateTime(end(active.at))}
            </span>
            {levelsOf(active).map((level) => (
              <span key={level} className="flex justify-between">
                <span>{level}</span>
                <span className="font-mono">{(active.levels[level] ?? 0).toLocaleString()}</span>
              </span>
            ))}
            <span className="flex justify-between font-medium">
              <span>Total</span>
              <span className="font-mono">{active.total.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
        <span>{buckets[0] ? formatDateTime(buckets[0].at) : ""}</span>
        <span>{buckets.length ? formatDateTime(end(buckets[buckets.length - 1]!.at)) : ""}</span>
      </div>
    </div>
  )
}
