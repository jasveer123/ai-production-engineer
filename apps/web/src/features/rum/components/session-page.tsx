"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime } from "@/lib/format/relative-time"
import { useRumReplay, useRumSession } from "../hooks"
import { formatDuration, pathOf, whoIs } from "../lib"
import { ReplayPlayer } from "./replay-player"

function describe(e: { type: string; name: string; url: string | null; value: number | null }) {
  if (e.type === "pageview") return `Opened ${pathOf(e.url)}`
  if (e.type === "click") return `Clicked ${e.name}`
  if (e.type === "error") return e.name
  if (e.type === "network") return `Request failed: ${e.name}`
  if (e.type === "console") return `Console: ${e.name}`
  if (e.type === "vital")
    return `${e.name} ${e.value === null ? "" : Math.round(e.value * 1000) / 1000}`
  return e.name
}

export function RumSessionPage() {
  const { id } = useParams<{ id: string }>()
  const { workspace, isPending } = useCurrentWorkspace()
  const session = useRumSession(workspace?.id, id)
  const replay = useRumReplay(workspace?.id, id, Boolean(session.data?.hasReplay))
  const [seek, setSeek] = React.useState<number | null>(null)

  if (isPending || (workspace && session.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null
  const data = session.data
  if (!data)
    return <p className="py-24 text-center text-sm text-muted-foreground">Session not found.</p>

  const start = new Date(data.startedAt).getTime()
  const end = new Date(data.lastSeenAt).getTime()

  return (
    <div className="grid min-w-0 gap-6">
      <Link
        href={ROUTES.rum}
        className="inline-flex w-fit items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-text"
      >
        <ArrowLeft className="size-4" /> All sessions
      </Link>
      <header className="grid gap-2 border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">{whoIs(data)}</h1>
          {data.errors > 0 && <Badge variant="destructive">{data.errors} errors</Badge>}
          <Badge>{data.appName}</Badge>
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {formatDateTime(data.startedAt)} · {formatDuration(data.durationSeconds)} ·{" "}
          {data.browser ?? "browser"} on {data.os ?? "?"} ({data.device ?? "device"}) ·{" "}
          {data.pageViews} pages · {data.clicks} clicks
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="grid content-start gap-2" aria-label="Replay">
          <Eyebrow>Replay</Eyebrow>
          {!data.hasReplay ? (
            <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
              Replay was off for this session.
            </p>
          ) : replay.isPending ? (
            <Spinner className="size-5" />
          ) : replay.data ? (
            <ReplayPlayer replay={replay.data} startMs={start} endMs={end} seekTo={seek} />
          ) : null}
        </section>
        <section className="grid content-start gap-2" aria-label="Timeline">
          <Eyebrow>What happened</Eyebrow>
          <ol className="grid max-h-[32rem] gap-1 overflow-y-auto">
            {data.events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSeek(new Date(e.ts).getTime() + Math.random() / 1000)}
                  className="grid w-full gap-0.5 border border-line px-3 py-2 text-left text-sm hover:bg-panel-2"
                >
                  <span className="flex items-center gap-2">
                    <Badge
                      variant={
                        e.type === "error"
                          ? "destructive"
                          : e.type === "network" || e.type === "console"
                            ? "warning"
                            : "default"
                      }
                    >
                      {e.type}
                    </Badge>
                    <span className="min-w-0 truncate">{describe(e)}</span>
                  </span>
                  <span className="font-mono text-[0.6875rem] text-muted-foreground">
                    +{((new Date(e.ts).getTime() - start) / 1000).toFixed(1)}s
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
