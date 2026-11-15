"use client"

import { X } from "lucide-react"
import { Button, Eyebrow, Field, Input } from "@/components/ui"
import type { DraftBranch, TargetOption } from "../draft"
import { ConditionEditor } from "./condition-editor"
import { StepsEditor } from "./steps-editor"

interface BranchEditorProps {
  index: number
  branch: DraftBranch
  options: TargetOption[]
  onChange: (branch: DraftBranch) => void
  onRemove: () => void
}

export function BranchEditor({ index, branch, options, onChange, onRemove }: BranchEditorProps) {
  const id = `branch-${index}`
  return (
    <div className="grid gap-3 border border-line-strong p-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Branch {index + 1}: used instead of the main steps when it matches</Eyebrow>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove branch ${index + 1}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <Field label="Branch name" htmlFor={`${id}-name`}>
        <Input
          id={`${id}-name`}
          value={branch.name}
          maxLength={80}
          placeholder="Out of hours"
          onChange={(e) => onChange({ ...branch, name: e.target.value })}
        />
      </Field>
      <ConditionEditor
        id={id}
        when={branch.when}
        onChange={(when) => onChange({ ...branch, when })}
      />
      <StepsEditor
        id={id}
        steps={branch.steps}
        options={options}
        onChange={(steps) => onChange({ ...branch, steps })}
      />
    </div>
  )
}
