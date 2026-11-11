"use client"

import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { useSchedules } from "../hooks"
import { ScheduleCard } from "./schedule-card"
import { ScheduleDialog } from "./schedule-dialog"

export function OncallPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const schedules = useSchedules(workspace?.id)

  if (isPending || (workspace && schedules.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = schedules.data ?? []
  const canSwap = ACTOR_ROLES.includes(workspace.role)

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Who's on call" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          A schedule rotates people through being on call. When an incident needs a person, the one
          on call is the one to reach.
        </p>
        {canManage && <ScheduleDialog workspaceId={workspace.id} schedule={null} />}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No schedules yet. Create one and add the people who take turns.
        </p>
      ) : (
        <div className="grid gap-5">
          {items.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              workspaceId={workspace.id}
              schedule={schedule}
              canManage={canManage}
              canSwap={canSwap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
