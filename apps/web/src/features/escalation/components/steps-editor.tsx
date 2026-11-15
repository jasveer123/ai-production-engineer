"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui"
import { emptyStep, type DraftStep, type TargetOption } from "../draft"
import { StepEditor } from "./step-editor"

interface StepsEditorProps {
  id: string
  steps: DraftStep[]
  options: TargetOption[]
  onChange: (steps: DraftStep[]) => void
}

export function StepsEditor({ id, steps, options, onChange }: StepsEditorProps) {
  return (
    <div className="grid gap-3">
      {steps.map((step, index) => (
        <StepEditor
          key={index}
          id={`${id}-${index}`}
          index={index}
          step={step}
          options={options}
          onChange={(next) => onChange(steps.map((s, i) => (i === index ? next : s)))}
          onRemove={
            steps.length > 1 ? () => onChange(steps.filter((_, i) => i !== index)) : undefined
          }
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...steps, emptyStep(5)])}
      >
        <Plus /> Add step
      </Button>
    </div>
  )
}
