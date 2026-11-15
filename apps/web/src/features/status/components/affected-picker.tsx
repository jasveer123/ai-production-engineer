"use client"

import { Chip } from "@/components/ui"
import { IMPACTS, STATE_LABEL } from "../constants"
import type { AffectedDraft } from "../requests"

interface AffectedPickerProps {
  resources: { id: string; publicName: string }[]
  value: AffectedDraft[]
  onChange: (next: AffectedDraft[]) => void
}

export function AffectedPicker({ resources, value, onChange }: AffectedPickerProps) {
  const impactOf = (id: string) => value.find((a) => a.resourceId === id)?.impact
  const setImpact = (resourceId: string, impact: string | null) =>
    onChange(
      impact
        ? [...value.filter((a) => a.resourceId !== resourceId), { resourceId, impact }]
        : value.filter((a) => a.resourceId !== resourceId)
    )

  if (resources.length === 0)
    return (
      <p className="text-[0.8125rem] text-muted-foreground">
        Add resources under Structure to mark them as affected.
      </p>
    )

  return (
    <div className="grid gap-2" role="group" aria-label="Affected resources">
      {resources.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <span className="w-40 truncate text-[0.8125rem] font-medium">{r.publicName}</span>
          <Chip selected={!impactOf(r.id)} onClick={() => setImpact(r.id, null)}>
            Not affected
          </Chip>
          {IMPACTS.map((impact) => (
            <Chip
              key={impact}
              selected={impactOf(r.id) === impact}
              onClick={() => setImpact(r.id, impact)}
            >
              {STATE_LABEL[impact]}
            </Chip>
          ))}
        </div>
      ))}
    </div>
  )
}
