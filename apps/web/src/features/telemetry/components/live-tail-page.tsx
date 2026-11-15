"use client"

import * as React from "react"
import { Eraser, Pause, Play, Search } from "lucide-react"
import { StatusStrip } from "@/components/shared"
import { Button, Input, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { EXPLORE_HINT } from "../constants"
import { TAIL_BUFFER, useTail } from "../hooks"
import { readUrlParams, writeUrlParams } from "../lib"
import { ExploreHeader } from "./explore-header"
import { TailList } from "./tail-list"

const STATUS_LABEL = {
  live: "Live",
  paused: "Paused",
  reconnecting: "Reconnecting",
  invalid: "Query error",
} as const

function initialQuery(): string {
  if (typeof window === "undefined") return ""
  const url = readUrlParams(["q", "service"])
  return url.q ?? (url.service ? `service:${url.service}` : "")
}

export function LiveTailPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [query, setQuery] = React.useState(initialQuery)
  const [draft, setDraft] = React.useState(query)
  const [paused, setPaused] = React.useState(false)
  const tail = useTail(workspace?.id, query, paused)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null

  const lines = tail.items.filter((item) => item.kind === "line").length

  return (
    <div className="grid min-w-0 gap-6">
      <ExploreHeader active="tail" title="Live tail" />
      <StatusStrip
        tone={
          tail.status === "live"
            ? "ok"
            : tail.status === "paused"
              ? "idle"
              : tail.status === "invalid"
                ? "bad"
                : "warn"
        }
        headline={STATUS_LABEL[tail.status]}
        detail={
          tail.status === "reconnecting"
            ? "Lost the connection. Retrying, and resuming from the last line seen."
            : `Keeps the newest ${TAIL_BUFFER.toLocaleString()} lines on screen.`
        }
        stats={[{ label: "Lines", value: lines.toLocaleString() }]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={tail.clear}>
              <Eraser /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPaused((value) => !value)}>
              {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
            </Button>
          </div>
        }
      />
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(draft.trim())
          writeUrlParams({ q: draft.trim(), service: undefined })
        }}
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Filter the tail"
              placeholder="Filter while tailing"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="pl-9 font-mono"
            />
          </div>
          <Button type="submit">Apply</Button>
        </div>
        {tail.error ? (
          <p role="alert" className="font-mono text-[0.75rem] text-danger">
            {tail.error}
          </p>
        ) : (
          <p className="font-mono text-[0.6875rem] text-muted-foreground">Try: {EXPLORE_HINT}</p>
        )}
      </form>
      <TailList items={tail.items} />
    </div>
  )
}
