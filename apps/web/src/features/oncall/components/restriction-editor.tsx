"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button, Chip, Eyebrow, Input } from "@/components/ui"
import { WEEKDAYS } from "../constants"
import type { Restriction } from "../schemas"

interface RestrictionEditorProps {
  restrictions: Restriction[]
  onChange: (restrictions: Restriction[]) => void
}

export function RestrictionEditor({ restrictions, onChange }: RestrictionEditorProps) {
  const update = (index: number, patch: Partial<Restriction>) =>
    onChange(restrictions.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const toggleDay = (index: number, day: number) => {
    const days = restrictions[index]!.days
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
    if (next.length > 0) update(index, { days: next })
  }

  return (
    <div className="grid gap-2">
      <Eyebrow>Only on call during</Eyebrow>
      {restrictions.length === 0 && (
        <p className="text-[0.8125rem] text-muted-foreground">Around the clock.</p>
      )}
      {restrictions.map((r, index) => (
        <div key={index} className="grid gap-2 border border-line p-2">
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((day, d) => (
              <Chip
                key={day}
                type="button"
                selected={r.days.includes(d)}
                onClick={() => toggleDay(index, d)}
              >
                {day}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input
              type="time"
              aria-label={`Window ${index + 1} start`}
              value={r.start}
              onChange={(event) => update(index, { start: event.target.value })}
            />
            <Input
              type="time"
              aria-label={`Window ${index + 1} end`}
              value={r.end}
              onChange={(event) => update(index, { end: event.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove window ${index + 1}`}
              onClick={() => onChange(restrictions.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() =>
          onChange([...restrictions, { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }])
        }
      >
        <Plus /> Add time window
      </Button>
    </div>
  )
}
