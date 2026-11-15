"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { TokenSecretNotice } from "@/features/integrations"
import { useChannels, useDeleteChannel, useTestChannel, useUpdateChannel } from "../hooks"
import type { ChannelWithSecret } from "../schemas"
import { ChannelCreateDialog } from "./channel-create-dialog"
import { ChannelRow } from "./channel-row"
import { ProvidersNotice } from "./providers-notice"

interface ChannelsPanelProps {
  workspaceId: string
}

export function ChannelsPanel({ workspaceId }: ChannelsPanelProps) {
  const channels = useChannels(workspaceId)
  const update = useUpdateChannel(workspaceId)
  const remove = useDeleteChannel(workspaceId)
  const test = useTestChannel(workspaceId)
  const [created, setCreated] = React.useState<ChannelWithSecret | null>(null)
  const pending = update.isPending || remove.isPending || test.isPending
  const items = channels.data ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          A channel is a shared place Pramaan sends messages: Slack, Microsoft Teams, an inbox, a
          phone number, or any URL that accepts a signed JSON POST. Escalation steps can target
          channels too.
        </p>
        <ChannelCreateDialog workspaceId={workspaceId} onCreated={setCreated} />
      </div>
      <ProvidersNotice workspaceId={workspaceId} />
      {created?.signingSecret && (
        <div className="grid gap-2">
          <TokenSecretNotice token={created.signingSecret} />
          <p className="text-[0.8125rem] text-muted-foreground">
            This is the signing secret. Your receiver uses it to check that a message came from
            Pramaan.
          </p>
        </div>
      )}
      {channels.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No channels yet. Add one so your team hears about incidents.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              pending={pending}
              onToggle={(id, enabled) => update.mutate({ id, body: { enabled } })}
              onTest={(id) => test.mutate(id)}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
