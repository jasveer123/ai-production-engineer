"use client"

import { StatusStrip, StorySteps } from "@/components/shared"
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

  const all = runs.data ?? []
  const active = all.filter((run) => run.state === "running")
  const unanswered = all.filter((run) => run.state === "completed")
  const create = canManage ? <PolicyDialog workspaceId={workspace.id} /> : null

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Escalation" />
      {items.length === 0 ? (
        <>
          <StatusStrip
            tone="idle"
            headline="Nobody gets paged automatically"
            detail="An escalation policy makes sure a serious incident is never ignored."
            action={create}
          />
          <StorySteps
            heading="How escalation works"
            steps={[
              {
                title: "An incident turns serious",
                text: "Critical and high severity incidents trigger the policy.",
              },
              { title: "Step one is reached", text: "The person on call is emailed first." },
              {
                title: "No answer? It climbs",
                text: "After the wait, the next step reaches more people until someone acknowledges.",
              },
            ]}
          />
        </>
      ) : (
        <>
          <StatusStrip
            tone={active.length > 0 || unanswered.length > 0 ? "warn" : "ok"}
            headline={
              active.length > 0
                ? `${active.length} escalation${active.length === 1 ? " is" : "s are"} running now`
                : unanswered.length > 0
                  ? `${unanswered.length} escalation${unanswered.length === 1 ? " ended" : "s ended"} with nobody answering`
                  : "Serious incidents will reach a person"
            }
            detail={
              active.length > 0
                ? "People are being notified step by step until someone acknowledges."
                : unanswered.length > 0
                  ? "Everyone on the policy was notified and nobody acknowledged. Check the people and steps below."
                  : "Policies are ready. Nothing is escalating right now."
            }
            action={create}
            stats={[
              { label: "Policies", value: items.length },
              { label: "Enabled", value: items.filter((p) => p.enabled).length },
              { label: "Steps, total", value: items.reduce((n, p) => n + p.steps.length, 0) },
              { label: "Unanswered", value: unanswered.length },
            ]}
          />
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
        </>
      )}
      <RunsPanel runs={runs.data ?? []} />
    </div>
  )
}
