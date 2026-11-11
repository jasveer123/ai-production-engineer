"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import {
  Button,
  Checkbox,
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
import { ROTATIONS } from "../constants"
import { useSaveSchedule, useWorkspaceMembers } from "../hooks"
import { fromLocalInput, toLocalInput } from "../lib"
import type { Member, Schedule } from "../schemas"

interface ScheduleDialogProps {
  workspaceId: string
  schedule: Schedule | null
}

const label = (member: Member) => member.name ?? member.email

export function ScheduleDialog({ workspaceId, schedule }: ScheduleDialogProps) {
  const members = useWorkspaceMembers(workspaceId)
  const save = useSaveSchedule(workspaceId)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(schedule?.name ?? "")
  const [hours, setHours] = React.useState(schedule?.rotationHours ?? 168)
  const [start, setStart] = React.useState(() =>
    toLocalInput(new Date(schedule?.anchorAt ?? Date.now()))
  )
  const [selected, setSelected] = React.useState<string[]>(
    schedule?.participants.map((p) => p.userId) ?? []
  )
  const all = members.data ?? []
  const nameOf = (id: string) => {
    const member = all.find((m) => m.userId === id)
    if (member) return label(member)
    const known = schedule?.participants.find((p) => p.userId === id)
    return known ? (known.name ?? known.email) : id
  }
  const valid = name.trim() && selected.length > 0

  const move = (index: number, direction: -1 | 1) =>
    setSelected((list) => {
      const next = [...list]
      ;[next[index], next[index + direction]] = [next[index + direction]!, next[index]!]
      return next
    })

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    save.mutate(
      {
        id: schedule?.id ?? null,
        body: {
          name: name.trim(),
          rotationHours: hours,
          anchorAt: fromLocalInput(start),
          participantIds: selected,
        },
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size={schedule ? "xs" : "sm"} variant={schedule ? "outline" : "default"} />}
      >
        {schedule ? (
          "Edit"
        ) : (
          <>
            <Plus /> New schedule
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{schedule ? "Edit schedule" : "New schedule"}</DialogTitle>
            <DialogDescription>
              People take turns being on call, in the order below. The first turn starts at the
              start time.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="schedule-name">
            <Input
              id="schedule-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Primary on-call"
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Hand over</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {ROTATIONS.map((item) => (
                <Chip
                  key={item.hours}
                  type="button"
                  selected={hours === item.hours}
                  onClick={() => setHours(item.hours)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="First turn starts" htmlFor="schedule-start">
            <Input
              id="schedule-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>People</Eyebrow>
            {all.map((member) => (
              <label key={member.userId} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(member.userId)}
                  onCheckedChange={(checked) =>
                    setSelected((list) =>
                      checked ? [...list, member.userId] : list.filter((id) => id !== member.userId)
                    )
                  }
                />
                {label(member)}{" "}
                <span className="text-[0.75rem] text-muted-foreground">{member.role}</span>
              </label>
            ))}
          </div>
          {selected.length > 1 && (
            <div className="grid gap-2">
              <Eyebrow>Order of turns</Eyebrow>
              <ol className="grid gap-1">
                {selected.map((id, index) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 border border-line px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="mr-2 font-mono text-[0.75rem] text-muted-foreground">
                        {index + 1}
                      </span>
                      {nameOf(id)}
                    </span>
                    <span className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move down"
                        disabled={index === selected.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending && <Spinner />} Save schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
