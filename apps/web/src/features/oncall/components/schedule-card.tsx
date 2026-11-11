"use client"

import { X } from "lucide-react"
import { Badge, Button, Eyebrow } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatDateTime } from "@/lib/format/relative-time"
import { ROTATIONS, SHOWN_SHIFTS } from "../constants"
import { useDeleteSchedule, useRemoveOverride } from "../hooks"
import { timeLeft } from "../lib"
import type { Schedule } from "../schemas"
import { OverrideDialog } from "./override-dialog"
import { PersonBadge } from "./person-badge"
import { ScheduleDialog } from "./schedule-dialog"
import { TimelineStrip } from "./timeline-strip"

interface ScheduleCardProps {
  workspaceId: string
  schedule: Schedule
  canManage: boolean
  canSwap: boolean
}

export function ScheduleCard({ workspaceId, schedule, canManage, canSwap }: ScheduleCardProps) {
  const remove = useDeleteSchedule(workspaceId)
  const removeOverride = useRemoveOverride(workspaceId)
  const rotation =
    ROTATIONS.find((item) => item.hours === schedule.rotationHours)?.label ??
    `Every ${schedule.rotationHours} hours`
  const index = (userId: string) =>
    Math.max(
      0,
      schedule.participants.findIndex((p) => p.userId === userId)
    )

  return (
    <article className="grid gap-5 border border-line bg-panel p-5" aria-label={schedule.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{schedule.name}</h2>
          <Badge>{rotation}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSwap && <OverrideDialog workspaceId={workspaceId} scheduleId={schedule.id} />}
          {canManage && (
            <>
              <ScheduleDialog workspaceId={workspaceId} schedule={schedule} />
              <ConfirmDialog
                triggerLabel="Delete"
                title={`Delete ${schedule.name}?`}
                description="Nobody is on call for this schedule afterwards. This cannot be undone."
                confirmLabel="Delete schedule"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(schedule.id)}
              />
            </>
          )}
        </div>
      </div>
      <div className="grid gap-1 border border-line-strong bg-sunken p-4">
        <Eyebrow>On call now</Eyebrow>
        {schedule.current ? (
          <>
            <PersonBadge
              person={schedule.current.person}
              index={index(schedule.current.person.userId)}
            />
            <p className="text-[0.8125rem] text-muted-foreground">
              until {formatDateTime(schedule.current.endsAt)}, in{" "}
              {timeLeft(schedule.current.endsAt)}
              {schedule.current.override ? ". Covering a swap." : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody. Add people to this schedule.</p>
        )}
      </div>
      <div className="grid gap-2">
        <Eyebrow>Next two weeks</Eyebrow>
        <TimelineStrip shifts={schedule.upcoming} participants={schedule.participants} />
      </div>
      <div className="grid gap-2">
        <Eyebrow>Upcoming shifts</Eyebrow>
        <ul className="grid gap-1.5">
          {schedule.upcoming.slice(0, SHOWN_SHIFTS).map((shift) => (
            <li
              key={`${shift.startsAt}-${shift.person.userId}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <PersonBadge person={shift.person} index={index(shift.person.userId)} />
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {formatDateTime(shift.startsAt)} to {formatDateTime(shift.endsAt)}
                {shift.override ? " (swap)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {schedule.overrides.length > 0 && (
        <div className="grid gap-2">
          <Eyebrow>Swaps</Eyebrow>
          <ul className="grid gap-1.5">
            {schedule.overrides.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <PersonBadge person={item.person} index={index(item.person.userId)} />
                <span className="flex items-center gap-2 font-mono text-[0.75rem] text-muted-foreground">
                  {formatDateTime(item.startsAt)} to {formatDateTime(item.endsAt)}
                  {canSwap && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove swap"
                      disabled={removeOverride.isPending}
                      onClick={() => removeOverride.mutate(item.id)}
                    >
                      <X />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
