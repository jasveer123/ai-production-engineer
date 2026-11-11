"use client"

import { Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useFunnelResult, useFunnels, useRemoveFunnel } from "../hooks"
import { FunnelDialog } from "./funnel-dialog"

interface FunnelsPanelProps {
  workspaceId: string
  minutes: number
  canEdit: boolean
}

function FunnelCard({
  workspaceId,
  id,
  minutes,
  canEdit,
}: {
  workspaceId: string
  id: string
  minutes: number
  canEdit: boolean
}) {
  const result = useFunnelResult(workspaceId, id, minutes)
  const remove = useRemoveFunnel(workspaceId)
  if (!result.data) return <Spinner className="size-5" />
  const first = Math.max(1, result.data.steps[0]?.sessions ?? 1)

  return (
    <article
      className="grid gap-3 border border-line bg-panel p-4"
      aria-label={result.data.funnel.name}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{result.data.funnel.name}</h2>
        {canEdit && (
          <ConfirmDialog
            triggerLabel="Delete"
            title={`Delete ${result.data.funnel.name}?`}
            description="The funnel definition is removed. Your session data is kept."
            confirmLabel="Delete funnel"
            pending={remove.isPending}
            onConfirm={() => remove.mutate(id)}
          />
        )}
      </div>
      <ol className="grid gap-2">
        {result.data.steps.map((step, i) => (
          <li key={i} className="grid gap-1">
            <div className="flex justify-between gap-2 text-sm">
              <span>
                {i + 1}. {step.label}
              </span>
              <span className="font-mono">
                {step.sessions.toLocaleString()} · {step.conversion}%
                {i > 0 && step.dropOff > 0 && <span className="text-danger"> −{step.dropOff}</span>}
              </span>
            </div>
            <div className="h-2 bg-line">
              <div
                className="h-full bg-brand"
                style={{ width: `${(step.sessions / first) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </article>
  )
}

export function FunnelsPanel({ workspaceId, minutes, canEdit }: FunnelsPanelProps) {
  const funnels = useFunnels(workspaceId)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] text-muted-foreground">
          A funnel counts the sessions that completed each step, in order.
        </p>
        {canEdit && <FunnelDialog workspaceId={workspaceId} />}
      </div>
      {(funnels.data ?? []).length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No funnels yet.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(funnels.data ?? []).map((f) => (
            <FunnelCard
              key={f.id}
              workspaceId={workspaceId}
              id={f.id}
              minutes={minutes}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}
