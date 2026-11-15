"use client"

import { ArrowDown, ArrowUp, X } from "lucide-react"
import { Button, Chip, Input, Switch } from "@/components/ui"
import { cn } from "@/lib/utils"
import { MANUAL_STATES, STATE_LABEL, STATE_TONE } from "../constants"
import type { ResourceDraft } from "../requests"

interface ResourceEditorProps {
  resource: ResourceDraft
  monitors: { id: string; name: string }[]
  state?: string
  disabled: boolean
  onChange: (next: ResourceDraft) => void
  onRemove: () => void
  onMove: (delta: number) => void
}

export function ResourceEditor({
  resource,
  monitors,
  state,
  disabled,
  onChange,
  onRemove,
  onMove,
}: ResourceEditorProps) {
  const set = (patch: Partial<ResourceDraft>) => onChange({ ...resource, ...patch })
  const toggle = (id: string) =>
    set({
      monitorIds: resource.monitorIds.includes(id)
        ? resource.monitorIds.filter((m) => m !== id)
        : [...resource.monitorIds, id],
    })

  return (
    <fieldset disabled={disabled} className="grid gap-3 border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Public name"
          className="w-60"
          maxLength={80}
          value={resource.publicName}
          placeholder="Public name, e.g. Checkout"
          onChange={(e) => set({ publicName: e.target.value })}
        />
        <Input
          aria-label="Explanation"
          className="min-w-0 flex-1"
          maxLength={300}
          value={resource.explanation}
          placeholder="Explanation shown to visitors (optional)"
          onChange={(e) => set({ explanation: e.target.value })}
        />
        {state && (
          <span className={cn("text-[0.75rem] font-medium", STATE_TONE[state])}>
            {STATE_LABEL[state] ?? state}
          </span>
        )}
        {!disabled && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move resource up"
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move resource down"
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove resource" onClick={onRemove}>
              <X />
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-1.5" role="group" aria-label="Linked monitors">
        <span className="text-[0.75rem] text-muted-foreground">Linked monitors</span>
        <div className="flex flex-wrap gap-2">
          {monitors.map((m) => (
            <Chip
              key={m.id}
              selected={resource.monitorIds.includes(m.id)}
              onClick={() => toggle(m.id)}
            >
              {m.name}
            </Chip>
          ))}
          {monitors.length === 0 && (
            <span className="text-[0.75rem] text-muted-foreground">No monitors yet.</span>
          )}
        </div>
      </div>
      {resource.monitorIds.length === 0 && (
        <div className="grid gap-1.5" role="group" aria-label="Manual state">
          <span className="text-[0.75rem] text-muted-foreground">Manual state</span>
          <div className="flex flex-wrap gap-2">
            {MANUAL_STATES.map((s) => (
              <Chip
                key={s}
                selected={resource.manualState === s}
                onClick={() => set({ manualState: s })}
              >
                {STATE_LABEL[s]}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-[0.8125rem]">
        <Switch
          size="sm"
          checked={resource.showHistory}
          onCheckedChange={(checked) => set({ showHistory: checked })}
        />
        Show 90-day history
      </label>
    </fieldset>
  )
}
