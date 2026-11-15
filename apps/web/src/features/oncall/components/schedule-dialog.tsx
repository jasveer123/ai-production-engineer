"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Field,
  Input,
  Spinner,
} from "@/components/ui"
import { SELECT_CLASS } from "../constants"
import { useSaveSchedule, useWorkspaceMembers } from "../hooks"
import { browserTimeZone, layerToRequest, newLayer, timeZones } from "../lib"
import type { LayerRequest, Schedule } from "../schemas"
import { LayerEditor } from "./layer-editor"

interface ScheduleDialogProps {
  workspaceId: string
  schedule: Schedule | null
}

export function ScheduleDialog({ workspaceId, schedule }: ScheduleDialogProps) {
  const members = useWorkspaceMembers(workspaceId)
  const save = useSaveSchedule(workspaceId)
  const zones = React.useMemo(() => timeZones(), [])
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(schedule?.name ?? "")
  const [timezone, setTimezone] = React.useState(schedule?.timezone ?? browserTimeZone())
  const [layers, setLayers] = React.useState<LayerRequest[]>(() =>
    schedule?.layers.length ? schedule.layers.map(layerToRequest) : [newLayer(0, timezone)]
  )
  const valid = name.trim() && layers.every((l) => l.name.trim() && l.participantIds.length > 0)

  const updateLayer = (index: number, layer: LayerRequest) =>
    setLayers((list) => list.map((l, i) => (i === index ? layer : l)))
  const moveLayer = (index: number, direction: -1 | 1) =>
    setLayers((list) => {
      const next = [...list]
      ;[next[index], next[index + direction]] = [next[index + direction]!, next[index]!]
      return next
    })

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    save.mutate(
      { id: schedule?.id ?? null, body: { name: name.trim(), timezone, layers } },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<Button size={schedule ? "xs" : "sm"} variant={schedule ? "outline" : "default"} />}
      >
        {schedule ? (
          "Edit"
        ) : (
          <>
            <Plus /> New schedule
          </>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>{schedule ? "Edit schedule" : "New schedule"}</DrawerTitle>
            <DrawerDescription>
              Handovers follow the local clock of the time zone, also across daylight saving
              changes. Layers higher in the list win where they overlap; swaps beat every layer.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="schedule-name">
            <Input
              id="schedule-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Primary on-call"
            />
          </Field>
          <Field label="Time zone" htmlFor="schedule-timezone">
            <select
              id="schedule-timezone"
              className={SELECT_CLASS}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
          {layers.map((layer, index) => (
            <LayerEditor
              key={layer.id}
              layer={layer}
              index={index}
              total={layers.length}
              members={members.data ?? []}
              onChange={(next) => updateLayer(index, next)}
              onMove={(direction) => moveLayer(index, direction)}
              onRemove={() => setLayers((list) => list.filter((_, i) => i !== index))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={layers.length >= 10}
            onClick={() => setLayers((list) => [...list, newLayer(list.length, timezone)])}
          >
            <Plus /> Add layer
          </Button>
          <DrawerFooter>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending && <Spinner />} Save schedule
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
