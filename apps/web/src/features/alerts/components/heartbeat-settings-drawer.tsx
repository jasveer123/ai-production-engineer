"use client"

import * as React from "react"
import { Settings2 } from "lucide-react"
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
import { useUpdateSource } from "../hooks"
import { pairsToRecord, recordToPairs } from "../lib"
import type { AlertSource } from "../schemas"
import { DurationInput } from "./duration-input"
import { MetadataPairs } from "./metadata-pairs"
import { PolicySelect } from "./policy-select"

interface HeartbeatSettingsDrawerProps {
  workspaceId: string
  source: AlertSource
}

export function HeartbeatSettingsDrawer({ workspaceId, source }: HeartbeatSettingsDrawerProps) {
  const beat = source.heartbeat
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(source.name)
  const [interval, setInterval] = React.useState(beat?.intervalSeconds ?? 300)
  const [grace, setGrace] = React.useState(beat?.graceSeconds ?? 60)
  const [metadata, setMetadata] = React.useState(recordToPairs(beat?.metadata ?? {}))
  const [policyId, setPolicyId] = React.useState(source.escalationPolicyId)
  const update = useUpdateSource(workspaceId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    update.mutate(
      {
        id: source.id,
        body: {
          name: name.trim(),
          intervalSeconds: interval,
          graceSeconds: grace,
          metadata: pairsToRecord(metadata),
          escalationPolicyId: policyId,
        },
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="outline" size="sm" />}>
        <Settings2 /> Settings
      </DrawerTrigger>
      <DrawerContent>
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Heartbeat settings</DrawerTitle>
            <DrawerDescription>Changes apply from the next deadline check.</DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="heartbeat-name">
            <Input
              id="heartbeat-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <DurationInput
            id="heartbeat-edit-period"
            label="Expect a heartbeat every"
            seconds={interval}
            onChange={setInterval}
          />
          <DurationInput
            id="heartbeat-edit-grace"
            label="Grace period"
            seconds={grace}
            onChange={setGrace}
          />
          <MetadataPairs pairs={metadata} onChange={setMetadata} />
          <PolicySelect
            id="heartbeat-edit-policy"
            workspaceId={workspaceId}
            value={policyId}
            onChange={setPolicyId}
          />
          <DrawerFooter>
            <Button type="submit" disabled={!name.trim() || interval < 30 || update.isPending}>
              {update.isPending && <Spinner />} Save
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
