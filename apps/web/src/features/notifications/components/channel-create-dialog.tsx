"use client"

import * as React from "react"
import { Plus } from "lucide-react"
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
import { CHANNEL_KINDS, EVENTS, MIN_SEVERITIES } from "../constants"
import { useCreateChannel } from "../hooks"
import type { ChannelWithSecret } from "../schemas"

interface ChannelCreateDialogProps {
  workspaceId: string
  onCreated: (channel: ChannelWithSecret) => void
}

export function ChannelCreateDialog({ workspaceId, onCreated }: ChannelCreateDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState("slack")
  const [name, setName] = React.useState("")
  const [target, setTarget] = React.useState("")
  const [events, setEvents] = React.useState<string[]>(EVENTS.map((item) => item.value))
  const [minSeverity, setMinSeverity] = React.useState("low")
  const create = useCreateChannel(workspaceId)
  const valid = name.trim() && target.trim() && events.length > 0

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    create.mutate(
      {
        kind,
        name: name.trim(),
        ...(kind === "slack" ? { webhookUrl: target.trim() } : { url: target.trim() }),
        events,
        minSeverity,
      },
      {
        onSuccess: (channel) => {
          onCreated(channel)
          setName("")
          setTarget("")
          setOpen(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> New channel
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>
              Choose where Pramaan tells your team about incidents.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_KINDS.map((item) => (
              <Chip
                key={item.value}
                type="button"
                selected={kind === item.value}
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <Field label="Name" htmlFor="channel-name">
            <Input
              id="channel-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="#alerts"
            />
          </Field>
          <Field
            label={kind === "slack" ? "Slack incoming webhook URL" : "Webhook URL"}
            htmlFor="channel-target"
            help={
              kind === "slack"
                ? "It starts with https://hooks.slack.com/services/"
                : "Pramaan sends a signed JSON POST."
            }
          >
            <Input
              id="channel-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                kind === "slack" ? "https://hooks.slack.com/services/…" : "https://example.com/hook"
              }
            />
          </Field>
          <div className="grid gap-2">
            <Eyebrow>Tell me when</Eyebrow>
            {EVENTS.map((item) => (
              <label key={item.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={events.includes(item.value)}
                  onCheckedChange={(checked) =>
                    setEvents((list) =>
                      checked ? [...list, item.value] : list.filter((v) => v !== item.value)
                    )
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
          <div className="grid gap-2">
            <Eyebrow>Only for severity</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {MIN_SEVERITIES.map((item) => (
                <Chip
                  key={item}
                  type="button"
                  selected={minSeverity === item}
                  onClick={() => setMinSeverity(item)}
                >
                  {item === "low" ? "Any" : `${item} and above`}
                </Chip>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending && <Spinner />} Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
