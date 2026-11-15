"use client"

import * as React from "react"
import Link from "next/link"
import { Video } from "lucide-react"
import { Badge, Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useRumSessions } from "../hooks"
import { formatDuration, pathOf, whoIs } from "../lib"
import type { SessionFilters as Filters } from "../schemas"
import { SessionFilters } from "./session-filters"

interface SessionsPanelProps {
  workspaceId: string
  appId: string
  minutes: number
  userId?: string
}

export function SessionsPanel({ workspaceId, appId, minutes, userId }: SessionsPanelProps) {
  const [filters, setFilters] = React.useState<Filters>({
    appId,
    minutes,
    hasErrors: false,
    q: "",
    browser: "",
    device: "",
    country: "",
    minSeconds: 0,
  })
  const query = {
    ...filters,
    q: filters.q.trim(),
    browser: filters.browser.trim(),
    appId,
    minutes,
    userId,
  }
  const sessions = useRumSessions(workspaceId, query)

  return (
    <div className="grid gap-4">
      <SessionFilters value={filters} onChange={setFilters} />
      {sessions.isPending ? (
        <Spinner className="size-5" />
      ) : (sessions.data ?? []).length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No sessions in this period.
        </p>
      ) : (
        <ul className="grid gap-2">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id}>
              <Link
                href={ROUTES.rumSession(s.id)}
                className="grid gap-1 border border-line bg-panel p-4 outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{whoIs(s)}</span>
                  <span className="flex items-center gap-2">
                    {s.hasReplay && (
                      <Badge variant="ai">
                        <Video className="size-3" /> replay
                      </Badge>
                    )}
                    {s.errors > 0 && <Badge variant="destructive">{s.errors} errors</Badge>}
                  </span>
                </div>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {pathOf(s.entryUrl)} · {s.pageViews} pages · {s.clicks} clicks ·{" "}
                  {formatDuration(s.durationSeconds)} · {s.browser ?? "browser"} on {s.os ?? "?"} ·{" "}
                  {s.country ? `${s.country} · ` : ""}
                  {s.droppedEvents > 0 ? `${s.droppedEvents} events lost · ` : ""}
                  {formatRelativeTime(s.lastSeenAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
