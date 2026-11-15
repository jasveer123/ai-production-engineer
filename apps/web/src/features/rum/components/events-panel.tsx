"use client"

import { Badge, Spinner } from "@/components/ui"
import { useRumEvents } from "../hooks"

interface EventsPanelProps {
  workspaceId: string
  appId: string
  minutes: number
}

export function EventsPanel({ workspaceId, appId, minutes }: EventsPanelProps) {
  const events = useRumEvents(workspaceId, appId, minutes)

  if (events.isPending) return <Spinner className="size-5" />
  const items = events.data ?? []

  return items.length === 0 ? (
    <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
      No events yet. Send one with{" "}
      <span className="font-mono">pramaan.track(&quot;signed_up&quot;)</span>.
    </p>
  ) : (
    <ul className="grid gap-1">
      {items.map((e) => (
        <li
          key={`${e.type}:${e.name}`}
          className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Badge variant={e.type === "error" ? "destructive" : "default"}>{e.type}</Badge>
            <span className="min-w-0 truncate font-mono">{e.name}</span>
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">
            {e.count.toLocaleString()} times · {e.sessions.toLocaleString()} sessions
          </span>
        </li>
      ))}
    </ul>
  )
}
