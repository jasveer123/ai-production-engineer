"use client"

import { Send } from "lucide-react"
import { Badge, Button, Switch } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { EVENT_LABEL } from "../constants"
import type { Channel } from "../schemas"

interface ChannelRowProps {
  channel: Channel
  pending: boolean
  onToggle: (id: string, enabled: boolean) => void
  onTest: (id: string) => void
  onDelete: (id: string) => void
}

export function ChannelRow({ channel, pending, onToggle, onTest, onDelete }: ChannelRowProps) {
  return (
    <li className="grid gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium">{channel.name}</span>
          <Badge>{channel.kind}</Badge>
          {!channel.enabled && <Badge variant="warning">Off</Badge>}
          <span className="font-mono text-[0.75rem] text-muted-foreground">{channel.target}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            aria-label={channel.enabled ? "Turn channel off" : "Turn channel on"}
            checked={channel.enabled}
            disabled={pending}
            onCheckedChange={(checked) => onToggle(channel.id, checked)}
          />
          <Button variant="outline" size="xs" disabled={pending} onClick={() => onTest(channel.id)}>
            <Send /> Send test
          </Button>
          <ConfirmDialog
            triggerLabel="Delete"
            title={`Delete ${channel.name}?`}
            description="Pramaan stops sending messages here. This cannot be undone."
            confirmLabel="Delete channel"
            pending={pending}
            onConfirm={() => onDelete(channel.id)}
          />
        </div>
      </div>
      <p className="text-[0.8125rem] leading-5 text-muted-foreground">
        {channel.events.map((event) => EVENT_LABEL[event] ?? event).join(", ")}.{" "}
        {channel.minSeverity === "low" ? "Any severity." : `${channel.minSeverity} and above.`}
      </p>
      <p
        className={`text-[0.8125rem] ${channel.lastError ? "text-danger" : "text-muted-foreground"}`}
      >
        {channel.lastError
          ? `Last error: ${channel.lastError}`
          : channel.lastDeliveryAt
            ? `Last message ${formatRelativeTime(channel.lastDeliveryAt)}`
            : "Nothing sent yet"}
      </p>
    </li>
  )
}
