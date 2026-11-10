"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"
import { Button, Chip, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { DEFAULT_RANGE, TIME_RANGES, type TimeRangeId } from "../constants"
import { useLiveTail } from "../hooks"
import { buildLogQuery } from "../lib"
import { EMPTY_FILTERS, type LogFilters as Filters } from "../schemas"
import { LogFilters } from "./log-filters"
import { LogHistogram } from "./log-histogram"
import { LogList } from "./log-list"

function initialFilters(): Filters {
  if (typeof window === "undefined") return EMPTY_FILTERS
  const service = new URLSearchParams(window.location.search).get("service")
  return service ? { ...EMPTY_FILTERS, services: [service] } : EMPTY_FILTERS
}

export function LiveTailPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [filters, setFilters] = React.useState<Filters>(initialFilters)
  const [paused, setPaused] = React.useState(false)
  const [range, setRange] = React.useState<TimeRangeId>(DEFAULT_RANGE)
  const query = buildLogQuery(filters)
  const { data, isFetching } = useLiveTail(workspace?.id, query, range, paused)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const total = data?.histogram.reduce((sum, bucket) => sum + bucket.total, 0) ?? 0
  const errors = data?.histogram.reduce((sum, bucket) => sum + bucket.errors, 0) ?? 0

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Eyebrow>Workspace · {workspace.name}</Eyebrow>
          <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
            Live tail
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.8125rem] text-muted-foreground">
            {paused ? "Paused" : isFetching ? "Updating" : "Live"} · {data?.lines.length ?? 0} lines
          </span>
          <Button variant="outline" size="sm" onClick={() => setPaused((value) => !value)}>
            {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>
      <LogFilters value={filters} services={data?.services ?? []} onChange={setFilters} />
      <div className="grid gap-3 border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Time</Eyebrow>
            {TIME_RANGES.map((item) => (
              <Chip key={item.id} selected={range === item.id} onClick={() => setRange(item.id)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <span className="text-[0.8125rem] text-muted-foreground">
            {total.toLocaleString()} logs · {errors.toLocaleString()} errors
          </span>
        </div>
        <LogHistogram
          buckets={data?.histogram ?? []}
          windowMs={TIME_RANGES.find((item) => item.id === range)!.ms}
        />
      </div>
      <LogList
        lines={data?.lines ?? []}
        loading={!data}
        emptyText="No logs match. New logs appear here as they arrive."
      />
    </div>
  )
}
