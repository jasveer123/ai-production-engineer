"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Chip,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Eyebrow,
  Field,
  Input,
  Spinner,
  Switch,
} from "@/components/ui"
import { REPEAT_OPTIONS, SEVERITIES } from "../constants"
import {
  emptyStep,
  stepsValid,
  toBranchRequests,
  toDraftBranches,
  toDraftSteps,
  toStepRequests,
  type DraftBranch,
  type DraftStep,
} from "../draft"
import { useCreatePolicy, useTargetOptions, useUpdatePolicy } from "../hooks"
import type { Policy } from "../schemas"
import { BranchEditor } from "./branch-editor"
import { StepsEditor } from "./steps-editor"

interface PolicyDialogProps {
  workspaceId: string
  policy?: Policy
}

export function PolicyDialog({ workspaceId, policy }: PolicyDialogProps) {
  const options = useTargetOptions(workspaceId)
  const createMutation = useCreatePolicy(workspaceId)
  const updateMutation = useUpdatePolicy(workspaceId)
  const pending = createMutation.isPending || updateMutation.isPending
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(policy?.name ?? "")
  const [severity, setSeverity] = React.useState<string>(policy?.minSeverity ?? "high")
  const [isDefault, setIsDefault] = React.useState(policy?.isDefault ?? false)
  const [repeatCount, setRepeatCount] = React.useState(policy?.repeatCount ?? 0)
  const [steps, setSteps] = React.useState<DraftStep[]>(
    policy ? toDraftSteps(policy.steps) : [emptyStep(0)]
  )
  const [branches, setBranches] = React.useState<DraftBranch[]>(toDraftBranches(policy))
  const valid =
    name.trim() &&
    stepsValid(steps) &&
    branches.every((branch) => branch.name.trim() && stepsValid(branch.steps))

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const body = {
      name: name.trim(),
      minSeverity: severity,
      enabled: policy?.enabled ?? true,
      isDefault,
      repeatCount,
      steps: toStepRequests(steps),
      branches: toBranchRequests(branches),
    }
    const done = { onSuccess: () => setOpen(false) }
    if (policy) updateMutation.mutate({ id: policy.id, body }, done)
    else createMutation.mutate(body, done)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<Button size={policy ? "xs" : "sm"} variant={policy ? "outline" : "default"} />}
      >
        {policy ? (
          "Edit"
        ) : (
          <>
            <Plus /> New policy
          </>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>{policy ? "Edit escalation policy" : "New escalation policy"}</DrawerTitle>
            <DrawerDescription>
              Steps run in order until someone acknowledges. Changes apply to new incidents; running
              escalations keep the steps they started with.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="policy-name">
            <Input
              id="policy-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production incidents"
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Escalate incidents at or above</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((item) => (
                <Chip key={item} selected={severity === item} onClick={() => setSeverity(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch size="sm" checked={isDefault} onCheckedChange={setIsDefault} />
            Workspace default (used when the alert source does not choose a policy)
          </label>
          <div className="grid gap-2">
            <Eyebrow>If nobody acknowledges after the last step, repeat</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {REPEAT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  selected={repeatCount === count}
                  onClick={() => setRepeatCount(count)}
                >
                  {count === 0 ? "Never" : `${count} time${count === 1 ? "" : "s"}`}
                </Chip>
              ))}
            </div>
          </div>
          <StepsEditor id="main" steps={steps} options={options} onChange={setSteps} />
          {branches.map((branch, index) => (
            <BranchEditor
              key={index}
              index={index}
              branch={branch}
              options={options}
              onChange={(next) =>
                setBranches((list) => list.map((b, i) => (i === index ? next : b)))
              }
              onRemove={() => setBranches((list) => list.filter((_, i) => i !== index))}
            />
          ))}
          {branches.length < 5 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setBranches((list) => [...list, { name: "", when: {}, steps: [emptyStep(0)] }])
              }
            >
              <Plus /> Add conditional branch
            </Button>
          )}
          <DrawerFooter>
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Spinner />} Save policy
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
