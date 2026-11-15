"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Button, Chip, Eyebrow, Input } from "@/components/ui"
import { EXPLORE_RANGES } from "../constants"
import type { ExploreParams, SavedQuery } from "../explore-schemas"
import { SavedQueriesMenu } from "./saved-queries-menu"

interface ExploreQueryBarProps {
  workspaceId: string
  signal: SavedQuery["signal"]
  value: ExploreParams
  hint: string
  error?: string | null
  onChange: (next: Partial<ExploreParams>) => void
}

const toLocal = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : "")
const toIso = (local: string) => (local ? new Date(`${local}Z`).toISOString() : undefined)

export function ExploreQueryBar({
  workspaceId,
  signal,
  value,
  hint,
  error,
  onChange,
}: ExploreQueryBarProps) {
  const [draft, setDraft] = React.useState(value.q)
  const [from, setFrom] = React.useState(toLocal(value.from))
  const [to, setTo] = React.useState(toLocal(value.to))
  const absolute = Boolean(value.from && value.to)

  return (
    <div className="grid gap-3 border border-line bg-panel p-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ q: draft.trim() })
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Query"
            aria-invalid={Boolean(error)}
            placeholder="Search or filter"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="pl-9 font-mono"
          />
        </div>
        <Button type="submit">Run</Button>
        <SavedQueriesMenu
          workspaceId={workspaceId}
          signal={signal}
          current={value}
          onPick={(saved) =>
            onChange({ q: saved.query, range: saved.range, from: undefined, to: undefined })
          }
        />
      </form>
      {error ? (
        <p role="alert" className="font-mono text-[0.75rem] text-danger">
          {error}
        </p>
      ) : (
        <p className="font-mono text-[0.6875rem] text-muted-foreground">Try: {hint}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Time</Eyebrow>
        {EXPLORE_RANGES.map((range) => (
          <Chip
            key={range.id}
            selected={!absolute && value.range === range.id}
            onClick={() => onChange({ range: range.id, from: undefined, to: undefined })}
          >
            {range.label}
          </Chip>
        ))}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (from && to) onChange({ from: toIso(from), to: toIso(to) })
          }}
        >
          <Input
            type="datetime-local"
            aria-label="From (UTC)"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-8 w-auto font-mono text-[0.75rem]"
          />
          <span className="text-[0.75rem] text-muted-foreground">to</span>
          <Input
            type="datetime-local"
            aria-label="To (UTC)"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-8 w-auto font-mono text-[0.75rem]"
          />
          <Button type="submit" size="sm" variant={absolute ? "default" : "outline"}>
            Apply UTC range
          </Button>
        </form>
      </div>
    </div>
  )
}
