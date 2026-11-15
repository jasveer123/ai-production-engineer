"use client"

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import { Button, Field, Input } from "@/components/ui"
import { ROTATION_UNITS, SELECT_CLASS } from "../constants"
import type { LayerRequest, Member, Rotation } from "../schemas"
import { PeoplePicker } from "./people-picker"
import { RestrictionEditor } from "./restriction-editor"

interface LayerEditorProps {
  layer: LayerRequest
  index: number
  total: number
  members: Member[]
  onChange: (layer: LayerRequest) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

const CUSTOM = "custom"

export function LayerEditor({
  layer,
  index,
  total,
  members,
  onChange,
  onMove,
  onRemove,
}: LayerEditorProps) {
  const rotation = layer.rotation
  const calendar: Extract<Rotation, { kind: "calendar" }> =
    rotation.kind === "calendar"
      ? rotation
      : {
          kind: "calendar",
          lengthDays: Math.max(1, Math.round(rotation.hours / 24)),
          startDate: rotation.anchorAt.slice(0, 10),
          handoffTime: rotation.anchorAt.slice(11, 16),
        }
  const preset = ROTATION_UNITS.some((u) => u.days === calendar.lengthDays)
  const unitValue =
    rotation.kind === "elapsed" ? "elapsed" : preset ? String(calendar.lengthDays) : CUSTOM
  const setCalendar = (patch: Partial<typeof calendar>) =>
    onChange({ ...layer, rotation: { ...calendar, ...patch } })
  const id = `layer-${layer.id}`

  return (
    <fieldset className="grid gap-3 border border-line p-3">
      <div className="flex items-end gap-2">
        <Field label={`Layer ${index + 1} name`} htmlFor={`${id}-name`} className="flex-1">
          <Input
            id={`${id}-name`}
            value={layer.name}
            maxLength={80}
            onChange={(event) => onChange({ ...layer, name: event.target.value })}
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Raise precedence"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Lower precedence"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove layer"
          disabled={total === 1}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Rotation" htmlFor={`${id}-unit`}>
          <select
            id={`${id}-unit`}
            className={SELECT_CLASS}
            value={unitValue}
            onChange={(event) => {
              const v = event.target.value
              setCalendar({ lengthDays: v === CUSTOM ? 3 : Number(v) || calendar.lengthDays })
            }}
          >
            {rotation.kind === "elapsed" && (
              <option value="elapsed">Every {rotation.hours} hours (fixed)</option>
            )}
            {ROTATION_UNITS.map((u) => (
              <option key={u.days} value={u.days}>
                {u.label}
              </option>
            ))}
            <option value={CUSTOM}>Every N days</option>
          </select>
        </Field>
        {unitValue === CUSTOM && (
          <Field label="Days per turn" htmlFor={`${id}-length`}>
            <Input
              id={`${id}-length`}
              type="number"
              min={1}
              max={90}
              value={calendar.lengthDays}
              onChange={(event) =>
                setCalendar({ lengthDays: Math.max(1, Number(event.target.value)) })
              }
            />
          </Field>
        )}
        <Field label="First turn starts on" htmlFor={`${id}-start`}>
          <Input
            id={`${id}-start`}
            type="date"
            value={calendar.startDate}
            onChange={(event) => setCalendar({ startDate: event.target.value })}
          />
        </Field>
        <Field label="Hand over at (local time)" htmlFor={`${id}-handoff`}>
          <Input
            id={`${id}-handoff`}
            type="time"
            value={calendar.handoffTime}
            onChange={(event) => setCalendar({ handoffTime: event.target.value })}
          />
        </Field>
      </div>
      <PeoplePicker
        members={members}
        selected={layer.participantIds}
        onChange={(participantIds) => onChange({ ...layer, participantIds })}
      />
      <RestrictionEditor
        restrictions={layer.restrictions}
        onChange={(restrictions) => onChange({ ...layer, restrictions })}
      />
    </fieldset>
  )
}
