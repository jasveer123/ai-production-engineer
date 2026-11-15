import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format/relative-time"
import { colorFor, displayName } from "../lib"
import type { Gap, Person } from "../schemas"

interface TimelineBlock {
  person: Person | null
  startsAt: string
  endsAt: string
  override: boolean
}

interface TimelineStripProps {
  shifts: { person: Person; startsAt: string; endsAt: string; override: boolean }[]
  gaps: Gap[]
  participants: Person[]
  label: string
}

export function TimelineStrip({ shifts, gaps, participants, label }: TimelineStripProps) {
  const blocks: TimelineBlock[] = [
    ...shifts,
    ...gaps.map((gap) => ({ ...gap, person: null, override: false })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  if (blocks.length === 0) return null
  const start = new Date(blocks[0]!.startsAt).getTime()
  const end = Math.max(...blocks.map((b) => new Date(b.endsAt).getTime()))
  const total = Math.max(1, end - start)

  return (
    <div className="grid gap-2">
      <div
        className="flex h-5 w-full overflow-hidden border border-line"
        role="img"
        aria-label={label}
      >
        {blocks.map((block) => {
          const index = block.person
            ? Math.max(
                0,
                participants.findIndex((p) => p.userId === block.person!.userId)
              )
            : 0
          const width =
            ((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / total) * 100
          const who = block.person ? displayName(block.person) : "Nobody on call"
          return (
            <span
              key={`${block.startsAt}-${block.person?.userId ?? "gap"}`}
              title={`${who}${block.override ? " (swap)" : ""}\n${formatDateTime(block.startsAt)} to ${formatDateTime(block.endsAt)}`}
              className={cn(
                block.person ? colorFor(index) : "bg-danger/20",
                "block h-full border-r border-panel",
                block.override && "opacity-60"
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
        {gaps.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 bg-danger/20" aria-hidden />
            Nobody on call
          </li>
        )}
      </ul>
    </div>
  )
}
