"use client"

import { Badge, Button } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { PolicyDialog } from "./policy-dialog"
import { PolicyPreview } from "./policy-preview"
import { PolicySteps } from "./policy-steps"
import { useDeletePolicy, useTogglePolicy } from "../hooks"
import type { Policy } from "../schemas"

interface PolicyCardProps {
  workspaceId: string
  policy: Policy
  canManage: boolean
}

export function PolicyCard({ workspaceId, policy, canManage }: PolicyCardProps) {
  const toggle = useTogglePolicy(workspaceId)
  const remove = useDeletePolicy(workspaceId)

  return (
    <article className="grid gap-4 border border-line bg-panel p-5" aria-label={policy.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{policy.name}</h2>
          <Badge>{policy.minSeverity}+</Badge>
          {policy.isDefault && <Badge variant="brand">default</Badge>}
          {policy.generated && <Badge>simple mode</Badge>}
          {policy.repeatCount > 0 && <Badge>repeats {policy.repeatCount}×</Badge>}
          {!policy.enabled && <Badge>paused</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <PolicyPreview workspaceId={workspaceId} policyId={policy.id} policyName={policy.name} />
          {canManage && (
            <>
              <PolicyDialog workspaceId={workspaceId} policy={policy} />
              <Button
                size="xs"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: policy.id, enabled: !policy.enabled })}
              >
                {policy.enabled ? "Pause" : "Resume"}
              </Button>
              <ConfirmDialog
                triggerLabel="Delete"
                title={`Delete ${policy.name}?`}
                description="New incidents stop using this policy. Running escalations finish with the steps they started with. This cannot be undone."
                confirmLabel="Delete policy"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(policy.id)}
              />
            </>
          )}
        </div>
      </div>
      <PolicySteps steps={policy.steps} />
      {policy.branches.map((branch) => (
        <div key={branch.name} className="grid gap-2 border-l-2 border-line-strong pl-3">
          <span className="text-[0.8125rem] font-medium">When {branch.name}</span>
          <PolicySteps steps={branch.steps} />
        </div>
      ))}
    </article>
  )
}
