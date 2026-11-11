"use client"

import { StoryBanner, StorySteps } from "@/components/shared"
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

  const covered = items.filter((item) => item.current)
  const gaps = items.length - covered.length
  const create = canManage ? <ScheduleDialog workspaceId={workspace.id} schedule={null} /> : null
  const first = covered[0]?.current
  const people = new Set(items.flatMap((item) => item.participants.map((p) => p.userId))).size

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Who's on call" />
      {items.length === 0 ? (
        <>
          <StoryBanner
            tone="idle"
            headline="Nobody is set to answer yet"
            detail="When something breaks at 3am, a person should be reached, not a shared inbox."
            action={create}
          />
          <StorySteps
            heading="How on-call works here"
            steps={[
              {
                title: "Pick the people",
                text: "Add the teammates who take turns being reachable.",
              },
              {
                title: "Choose a rotation",
                text: "Daily, weekly or custom. Swaps cover holidays and sick days.",
              },
              {
                title: "Escalation uses it",
                text: "An alert pages whoever is on call, then the next person if they miss it.",
              },
            ]}
          />
        </>
      ) : (
        <>
          <StoryBanner
            tone={gaps > 0 ? "warn" : "ok"}
            headline={
              gaps > 0
                ? `${gaps} schedule${gaps === 1 ? " has" : "s have"} nobody on call`
                : first
                  ? `${first.person.name ?? first.person.email} is on call`
                  : "Someone is always on call"
            }
            detail={
              gaps > 0
                ? "Add people to these schedules so an alert never goes unanswered."
                : "Every schedule has a person who will be paged first."
            }
            action={create}
            stats={[
              { label: "Schedules", value: items.length },
              { label: "People in rotation", value: people },
              { label: "Covered now", value: `${covered.length} of ${items.length}` },
              {
                label: "Swaps planned",
                value: items.reduce((sum, item) => sum + item.overrides.length, 0),
              },
            ]}
          />
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
        </>
      )}
    </div>
  )
}
