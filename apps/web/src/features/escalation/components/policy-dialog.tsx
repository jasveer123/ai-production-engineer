"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
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
} from "@/components/ui"
import { useSchedules, useWorkspaceMembers } from "@/features/oncall"
import { SEVERITIES } from "../constants"
import { useCreatePolicy, useUpdatePolicy } from "../hooks"
import type { Policy, TargetRequest } from "../schemas"

interface PolicyDialogProps {
  workspaceId: string
  policy?: Policy
}

interface DraftStep {
  waitMinutes: number
  targets: string[]
}

const EVERYONE = "everyone"

const keyOfTarget = (target: Policy["steps"][number]["targets"][number]) =>
  target.kind === "everyone" ? EVERYONE : `${target.kind}:${target.scheduleId ?? target.userId}`

const toTarget = (key: string): TargetRequest => {
  if (key === EVERYONE) return { kind: "everyone" }
  const [kind, id] = key.split(":") as ["schedule" | "user", string]
  return kind === "schedule" ? { kind, scheduleId: id } : { kind, userId: id }
}

export function PolicyDialog({ workspaceId, policy }: PolicyDialogProps) {
  const schedules = useSchedules(workspaceId)
  const members = useWorkspaceMembers(workspaceId)
  const createMutation = useCreatePolicy(workspaceId)
  const updateMutation = useUpdatePolicy(workspaceId)
  const pending = createMutation.isPending || updateMutation.isPending
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(policy?.name ?? "")
  const [severity, setSeverity] = React.useState<string>(policy?.minSeverity ?? "high")
  const [steps, setSteps] = React.useState<DraftStep[]>(
    policy?.steps.map((step) => ({
      waitMinutes: step.waitMinutes,
      targets: step.targets.map(keyOfTarget),
    })) ?? [{ waitMinutes: 0, targets: [] }]
  )
  const options = [
    { key: EVERYONE, label: "Everyone" },
    ...(schedules.data ?? []).map((s) => ({
      key: `schedule:${s.id}`,
      label: `On call · ${s.name}`,
    })),
    ...(members.data ?? []).map((m) => ({ key: `user:${m.userId}`, label: m.name ?? m.email })),
  ]
  const valid = name.trim() && steps.every((step) => step.targets.length > 0)

  const patch = (index: number, change: Partial<DraftStep>) =>
    setSteps((list) => list.map((step, i) => (i === index ? { ...step, ...change } : step)))

  const toggle = (index: number, key: string) => {
    const current = steps[index]!.targets
    patch(index, {
      targets: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    })
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    const body = {
      name: name.trim(),
      minSeverity: severity,
      enabled: policy?.enabled ?? true,
      steps: steps.map((step) => ({
        waitMinutes: step.waitMinutes,
        targets: step.targets.map(toTarget),
      })),
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
              Each step emails people. If nobody acknowledges the incident, the next step runs after
              its wait.
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
            <Eyebrow>Applies to incidents at or above</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((item) => (
                <Chip key={item} selected={severity === item} onClick={() => setSeverity(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          {steps.map((step, index) => (
            <div key={index} className="grid gap-3 border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>Step {index + 1}</Eyebrow>
                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {index > 0 && (
                <Field label="Wait before this step (minutes)" htmlFor={`wait-${index}`}>
                  <Input
                    id={`wait-${index}`}
                    type="number"
                    min={1}
                    max={1440}
                    value={step.waitMinutes}
                    onChange={(e) => patch(index, { waitMinutes: Number(e.target.value) })}
                  />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <Chip
                    key={option.key}
                    selected={step.targets.includes(option.key)}
                    onClick={() => toggle(index, option.key)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSteps((list) => [...list, { waitMinutes: 5, targets: [] }])}
          >
            <Plus /> Add step
          </Button>
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
