"use client"

import * as React from "react"
import { Zap } from "lucide-react"
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
  Spinner,
} from "@/components/ui"
import { useSchedules, useWorkspaceMembers } from "@/features/oncall"
import { ESCALATE_AFTER, PERSON_CHANNELS } from "../constants"
import { useSaveSimplePolicy } from "../hooks"
import type { SimplePolicyRequest } from "../schemas"

interface SimplePolicyDialogProps {
  workspaceId: string
}

export function SimplePolicyDialog({ workspaceId }: SimplePolicyDialogProps) {
  const schedules = useSchedules(workspaceId)
  const members = useWorkspaceMembers(workspaceId)
  const save = useSaveSimplePolicy(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [primary, setPrimary] = React.useState("")
  const [channels, setChannels] = React.useState<string[]>(["email"])
  const [after, setAfter] = React.useState<number | null>(5)
  const options = [
    ...(schedules.data ?? []).map((s) => ({
      key: `schedule:${s.id}`,
      label: `On call · ${s.name}`,
    })),
    ...(members.data ?? []).map((m) => ({ key: `user:${m.userId}`, label: m.name ?? m.email })),
  ]

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const [kind, id] = primary.split(":")
    if (!id || channels.length === 0) return
    const target: SimplePolicyRequest["primary"] =
      kind === "schedule" ? { kind: "schedule", scheduleId: id } : { kind: "user", userId: id }
    save.mutate(
      { primary: target, channels, escalateAfterMinutes: after },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        <Zap /> Quick policy
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Notify a primary responder</DrawerTitle>
            <DrawerDescription>
              Creates a policy you can pick on any monitor, heartbeat or alert source.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-2">
            <Eyebrow>Primary responder</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Chip
                  key={option.key}
                  selected={primary === option.key}
                  onClick={() => setPrimary(option.key)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Eyebrow>Notify by</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {PERSON_CHANNELS.map((item) => (
                <Chip
                  key={item.value}
                  selected={channels.includes(item.value)}
                  onClick={() =>
                    setChannels((list) =>
                      list.includes(item.value)
                        ? list.filter((v) => v !== item.value)
                        : [...list, item.value]
                    )
                  }
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Eyebrow>If not acknowledged, alert all other team members</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {ESCALATE_AFTER.map((item) => (
                <Chip
                  key={item.label}
                  selected={after === item.value}
                  onClick={() => setAfter(item.value)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <DrawerFooter>
            <Button type="submit" disabled={!primary || channels.length === 0 || save.isPending}>
              {save.isPending && <Spinner />} Create policy
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
