"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Pause, Play } from "lucide-react"
import { Badge, Button, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime, formatRelativeTime } from "@/lib/format/relative-time"
import { HEARTBEAT_STATE_LABEL, HEARTBEAT_STATE_VARIANT } from "../constants"
import { useHeartbeatDetail, useSourceAlerts, useUpdateSource } from "../hooks"
import { formatSeconds } from "../lib"
import { HeartbeatPingsTable } from "./heartbeat-pings-table"
import { HeartbeatSettingsDrawer } from "./heartbeat-settings-drawer"
import { HeartbeatSnippets } from "./heartbeat-snippets"
import { SourceIncidents } from "./source-incidents"

export function HeartbeatDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const detail = useHeartbeatDetail(workspace?.id, id)
  const alerts = useSourceAlerts(workspace?.id, id)
  const update = useUpdateSource(workspace?.id ?? "")

  if (isPending || (workspace && detail.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null
  if (!detail.data?.source.heartbeat) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        This heartbeat was not found in your workspace.
      </p>
    )
  }

  const { source, pingUrl, pings } = detail.data
  const beat = source.heartbeat!
  const metadata = Object.entries(beat.metadata)

  return (
    <div className="grid min-w-0 gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={ROUTES.heartbeats} />}
      >
        <ArrowLeft /> All heartbeats
      </Button>
      <header className="grid gap-4 border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <Badge
              className="w-fit"
              variant={
                HEARTBEAT_STATE_VARIANT[beat.state as keyof typeof HEARTBEAT_STATE_VARIANT] ??
                "default"
              }
            >
              {HEARTBEAT_STATE_LABEL[beat.state] ?? beat.state}
            </Badge>
            <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
              {source.name}
            </h1>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: source.id, body: { paused: !beat.paused } })}
              >
                {beat.paused ? <Play /> : <Pause />} {beat.paused ? "Resume" : "Pause"}
              </Button>
              <HeartbeatSettingsDrawer workspaceId={workspace.id} source={source} />
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Expected every</dt>
            <dd>{formatSeconds(beat.intervalSeconds)}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Grace period</dt>
            <dd>{formatSeconds(beat.graceSeconds)}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Last ping</dt>
            <dd>{beat.lastPingAt ? formatRelativeTime(beat.lastPingAt) : "Never"}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Next ping due</dt>
            <dd>{beat.dueAt ? formatDateTime(beat.dueAt) : "After the first ping"}</dd>
          </div>
        </dl>
        {beat.running && (
          <p className="text-[0.8125rem] text-muted-foreground">
            Running since {formatDateTime(beat.running.startedAt)}
            {beat.running.executionId ? ` (execution ${beat.running.executionId})` : ""}
          </p>
        )}
        {metadata.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metadata.map(([key, value]) => (
              <Badge key={key}>
                {key}: {value}
              </Badge>
            ))}
          </div>
        )}
      </header>
      <section className="grid gap-3 border border-line bg-panel p-5">
        <Eyebrow>How to ping</Eyebrow>
        <HeartbeatSnippets pingUrl={pingUrl} intervalSeconds={beat.intervalSeconds} />
      </section>
      <section className="grid gap-3">
        <Eyebrow>Incidents</Eyebrow>
        <SourceIncidents alerts={alerts.data ?? []} />
      </section>
      <section className="grid gap-3">
        <Eyebrow>Recent pings</Eyebrow>
        <HeartbeatPingsTable pings={pings} />
      </section>
    </div>
  )
}
