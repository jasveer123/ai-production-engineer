"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import {
  INTEGRATIONS,
  OverviewHero,
  PageHeading,
  SourceHealthTable,
  StatusCards,
  UsagePanel,
  useIngestOverview,
  useUsage,
} from "@/features/integrations"

export function DashboardPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [live, setLive] = React.useState(true)
  const { data: overview } = useIngestOverview(workspace?.id, live)
  const usage = useUsage(workspace?.id, live)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        You are not in a workspace yet. Ask an owner to invite you.
      </p>
    )
  }

  return (
    <div className="grid min-w-0 gap-8">
      <PageHeading workspaceName={workspace.name} title="Dashboard" />
      <OverviewHero
        workspaceId={workspace.id}
        overview={overview}
        live={live}
        onToggleLive={() => setLive((value) => !value)}
      />
      <StatusCards definitions={INTEGRATIONS} overview={overview} />
      <div className="border border-line bg-panel p-5">
        <UsagePanel buckets={usage.data?.histogram} overview={overview} />
      </div>
      <SourceHealthTable overview={overview} />
    </div>
  )
}
