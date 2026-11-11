"use client"

import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { SourcesPanel } from "./sources-panel"

export function HeartbeatsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()

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
      <PageHeading workspaceName={workspace.name} title="Heartbeats" />
      <SourcesPanel workspaceId={workspace.id} canManage={canManage} heartbeats />
    </div>
  )
}
