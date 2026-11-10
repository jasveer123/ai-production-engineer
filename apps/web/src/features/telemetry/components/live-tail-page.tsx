"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"
import { Button, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { useLiveTail } from "../hooks"
import { buildLogQuery } from "../lib"
import { EMPTY_FILTERS, type LogFilters as Filters } from "../schemas"
import { LogFilters } from "./log-filters"
import { LogList } from "./log-list"

export function LiveTailPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [paused, setPaused] = React.useState(false)
  const query = buildLogQuery(filters)
  const { data, isFetching } = useLiveTail(workspace?.id, query, paused)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

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
      <LogList
        lines={data?.lines ?? []}
        loading={!data}
        emptyText="No logs match. New logs appear here as they arrive."
      />
    </div>
  )
}
