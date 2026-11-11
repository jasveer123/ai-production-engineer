"use client"

import * as React from "react"
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Eyebrow,
  Field,
  Input,
  Spinner,
} from "@/components/ui"
import { useAddOverride, useWorkspaceMembers } from "../hooks"
import { fromLocalInput, toLocalInput } from "../lib"

interface OverrideDialogProps {
  workspaceId: string
  scheduleId: string
}

const HOUR = 3_600_000

export function OverrideDialog({ workspaceId, scheduleId }: OverrideDialogProps) {
  const members = useWorkspaceMembers(workspaceId)
  const add = useAddOverride(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [userId, setUserId] = React.useState("")
  const [start, setStart] = React.useState(() => toLocalInput(new Date()))
  const [end, setEnd] = React.useState(() => toLocalInput(new Date(Date.now() + 8 * HOUR)))
  const valid = userId && new Date(end) > new Date(start)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    add.mutate(
      {
        id: scheduleId,
        body: { userId, startsAt: fromLocalInput(start), endsAt: fromLocalInput(end) },
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="outline" />}>Swap a shift</DialogTrigger>
      <DialogContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Swap a shift</DialogTitle>
            <DialogDescription>
              Someone else covers for a while. The normal rotation carries on after it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Eyebrow>Who covers</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {(members.data ?? []).map((member) => (
                <Chip
                  key={member.userId}
                  type="button"
                  selected={userId === member.userId}
                  onClick={() => setUserId(member.userId)}
                >
                  {member.name ?? member.email}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From" htmlFor="override-start">
              <Input
                id="override-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Until" htmlFor="override-end">
              <Input
                id="override-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || add.isPending}>
              {add.isPending && <Spinner />} Save swap
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
