"use client"

import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { usePolicies, useRuns } from "../hooks"
import { PolicyCard } from "./policy-card"
import { PolicyDialog } from "./policy-dialog"
import { RunsPanel } from "./runs-panel"

export function EscalationPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const policies = usePolicies(workspace?.id)
  const runs = useRuns(workspace?.id)

  if (isPending || (workspace && policies.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = policies.data ?? []

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Escalation" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          When an incident is serious enough, the policy emails people step by step until someone
          acknowledges it.
        </p>
        {canManage && <PolicyDialog workspaceId={workspace.id} />}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No policies yet. Create one to get people notified automatically.
        </p>
      ) : (
        <div className="grid gap-5">
          {items.map((policy) => (
            <PolicyCard
              key={policy.id}
              workspaceId={workspace.id}
              policy={policy}
              canManage={canManage}
            />
          ))}
        </div>
      )}
      <RunsPanel runs={runs.data ?? []} />
    </div>
  )
}
