"use client"

import { Eyebrow, Spinner } from "@/components/ui"
import { useMaintenances, useRemoveMaintenance, useStructure } from "../hooks"
import { MaintenanceForm } from "./maintenance-form"
import { MaintenanceItem } from "./maintenance-item"

interface MaintenanceTabProps {
  workspaceId: string
  pageId: string
  canPost: boolean
}

const GROUPS = [
  { phase: "in_progress", label: "In progress" },
  { phase: "upcoming", label: "Upcoming" },
  { phase: "completed", label: "Completed" },
] as const

export function MaintenanceTab({ workspaceId, pageId, canPost }: MaintenanceTabProps) {
  const list = useMaintenances(workspaceId, pageId)
  const structure = useStructure(workspaceId, pageId)
  const remove = useRemoveMaintenance(workspaceId, pageId)
  const resources = (structure.data?.sections ?? []).flatMap((s) =>
    s.resources.map((r) => ({ id: r.id, publicName: r.publicName }))
  )
  const items = list.data ?? []

  return (
    <div className="grid gap-5">
      {canPost && (
        <MaintenanceForm workspaceId={workspaceId} pageId={pageId} resources={resources} />
      )}
      {list.isPending && <Spinner className="size-5" />}
      {!list.isPending && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No maintenance scheduled.</p>
      )}
      {GROUPS.map((group) => {
        const inGroup = items.filter((m) => m.phase === group.phase)
        if (inGroup.length === 0) return null
        return (
          <section key={group.phase} className="grid gap-2" aria-label={group.label}>
            <Eyebrow>{group.label}</Eyebrow>
            {inGroup.map((m) => (
              <MaintenanceItem
                key={m.id}
                maintenance={m}
                onRemove={canPost ? () => remove.mutate(m.id) : undefined}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}
