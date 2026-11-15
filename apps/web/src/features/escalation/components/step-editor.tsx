"use client"

import { X } from "lucide-react"
import { Button, Chip, Eyebrow, Field, Input } from "@/components/ui"
import { PERSON_CHANNELS } from "../constants"
import type { DraftStep, TargetOption } from "../draft"

interface StepEditorProps {
  id: string
  index: number
  step: DraftStep
  options: TargetOption[]
  onChange: (step: DraftStep) => void
  onRemove?: () => void
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

export function StepEditor({ id, index, step, options, onChange, onRemove }: StepEditorProps) {
  return (
    <div className="grid gap-3 border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Step {index + 1}</Eyebrow>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove step ${index + 1}`}
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
      {index > 0 && (
        <Field label="If nobody acknowledges, wait (minutes)" htmlFor={`${id}-wait`}>
          <Input
            id={`${id}-wait`}
            type="number"
            min={0}
            max={1440}
            value={step.waitMinutes}
            onChange={(e) => onChange({ ...step, waitMinutes: Number(e.target.value) })}
          />
        </Field>
      )}
      <div className="grid gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">Notify</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Step ${index + 1} targets`}>
          {options.map((option) => (
            <Chip
              key={option.key}
              selected={step.targets.includes(option.key)}
              onClick={() => onChange({ ...step, targets: toggle(step.targets, option.key) })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-[0.8125rem] text-muted-foreground">People are reached by</span>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={`Step ${index + 1} channels`}
        >
          {PERSON_CHANNELS.map((channel) => (
            <Chip
              key={channel.value}
              selected={step.channels.includes(channel.value)}
              onClick={() => onChange({ ...step, channels: toggle(step.channels, channel.value) })}
            >
              {channel.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
