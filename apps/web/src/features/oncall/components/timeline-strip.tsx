import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format/relative-time"
import { colorFor, displayName } from "../lib"
import type { Person, Shift } from "../schemas"

interface TimelineStripProps {
  shifts: Shift[]
  participants: Person[]
}

export function TimelineStrip({ shifts, participants }: TimelineStripProps) {
  if (shifts.length === 0) return null
  const start = new Date(shifts[0]!.startsAt).getTime()
  const end = new Date(shifts[shifts.length - 1]!.endsAt).getTime()
  const total = Math.max(1, end - start)

  return (
    <div className="grid gap-2">
      <div
        className="flex h-5 w-full overflow-hidden border border-line"
        role="img"
        aria-label="Who is on call over the next two weeks"
      >
        {shifts.map((shift) => {
          const index = Math.max(
            0,
            participants.findIndex((p) => p.userId === shift.person.userId)
          )
          const width =
            ((new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / total) * 100

          return (
            <span
              key={`${shift.startsAt}-${shift.person.userId}`}
              title={`${displayName(shift.person)}${shift.override ? " (swap)" : ""}\n${formatDateTime(shift.startsAt)} to ${formatDateTime(shift.endsAt)}`}
              className={cn(
                colorFor(index),
                "block h-full border-r border-panel",
                shift.override && "opacity-60"
              )}
              style={{ width: `${width}%` }}
            />
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
        {participants.map((person, index) => (
          <li key={person.userId} className="flex items-center gap-1.5">
            <span className={cn("size-2.5", colorFor(index))} aria-hidden />
            {displayName(person)}
          </li>
        ))}
      </ul>
    </div>
  )
}
