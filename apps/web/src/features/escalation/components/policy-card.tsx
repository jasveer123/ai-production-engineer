"use client"

import { Badge, Button } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { PolicyDialog } from "./policy-dialog"
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
          {!policy.enabled && <Badge>paused</Badge>}
        </div>
        {canManage && (
          <div className="flex gap-2">
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
              description="Incidents stop escalating under this policy. This cannot be undone."
              confirmLabel="Delete policy"
              pending={remove.isPending}
              onConfirm={() => remove.mutate(policy.id)}
            />
          </div>
        )}
      </div>
      <ol className="grid gap-2">
        {policy.steps.map((step, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {index === 0 ? "Immediately" : `After ${step.waitMinutes} min`}
            </span>
            {step.targets.map((target, i) => (
              <Badge key={i}>{target.label}</Badge>
            ))}
          </li>
        ))}
      </ol>
    </article>
  )
}
