"use client"

import { StoryBanner } from "@/components/shared"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useAlertSources } from "../hooks"
import { SourcesPanel } from "./sources-panel"

export function HeartbeatsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const sources = useAlertSources(workspace?.id)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const beats = (sources.data ?? []).filter((item) => item.kind === "heartbeat")
  const missed = beats.filter(
    (item) =>
      item.heartbeat?.state && item.heartbeat.state !== "up" && item.heartbeat.state !== "waiting"
  )

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Heartbeats" />
      <StoryBanner
        tone={missed.length > 0 ? "bad" : beats.length === 0 ? "idle" : "ok"}
        headline={
          missed.length > 0
            ? `${missed.length} job${missed.length === 1 ? " has" : "s have"} gone quiet`
            : beats.length === 0
              ? "Your scheduled jobs are not being watched"
              : "Every job checked in on time"
        }
        detail={
          beats.length === 0
            ? "Add a heartbeat, then have your cron job or backup call its URL when it finishes. If it stops, you are alerted."
            : "A heartbeat alerts you when something that should run on a schedule stops running."
        }
        stats={[
          { label: "Heartbeats", value: beats.length },
          { label: "Late or missing", value: missed.length },
        ]}
      />
      <SourcesPanel workspaceId={workspace.id} canManage={canManage} heartbeats />
    </div>
  )
}
