"use client"

import { RotateCw } from "lucide-react"
import { Badge, Button } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { CopyButton } from "@/features/integrations"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { HEARTBEAT_STATE_LABEL, HEARTBEAT_STATE_VARIANT, SOURCE_KIND_LABEL } from "../constants"
import type { AlertSource } from "../schemas"

interface SourceRowProps {
  source: AlertSource
  canManage: boolean
  pending: boolean
  onRotate: (id: string) => void
  onDelete: (id: string) => void
}

export function SourceRow({ source, canManage, pending, onRotate, onDelete }: SourceRowProps) {
  const heartbeat = source.heartbeat

  return (
    <li className="grid gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium">{source.name}</span>
          <Badge>{SOURCE_KIND_LABEL[source.kind] ?? source.kind}</Badge>
          {heartbeat ? (
            <Badge
              variant={
                HEARTBEAT_STATE_VARIANT[heartbeat.state as keyof typeof HEARTBEAT_STATE_VARIANT] ??
                "default"
              }
            >
              {HEARTBEAT_STATE_LABEL[heartbeat.state] ?? heartbeat.state}
            </Badge>
          ) : (
            <Badge variant={source.lastReceivedAt ? "success" : "default"}>
              {source.lastReceivedAt ? "Receiving" : "Waiting for first alert"}
            </Badge>
          )}
          <span className="text-[0.8125rem] text-muted-foreground">
            {heartbeat
              ? heartbeat.lastPingAt
                ? `last ping ${formatRelativeTime(heartbeat.lastPingAt)}`
                : "no ping yet"
              : source.lastReceivedAt
                ? `last alert ${formatRelativeTime(source.lastReceivedAt)}`
                : ""}
          </span>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => onRotate(source.id)}
            >
              <RotateCw /> New token
            </Button>
            <ConfirmDialog
              triggerLabel="Delete"
              title={`Delete ${source.name}?`}
              description="Anything still sending to this source is rejected from then on. This cannot be undone."
              confirmLabel="Delete source"
              pending={pending}
              onConfirm={() => onDelete(source.id)}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border border-line bg-sunken py-1 pr-1 pl-3 font-mono text-[0.75rem]">
        <span className="min-w-0 truncate">{source.url}</span>
        <CopyButton text={source.url} label="Copy URL" />
      </div>
      {heartbeat && (
        <p className="text-[0.8125rem] text-muted-foreground">
          Expected every {Math.round(heartbeat.intervalSeconds / 60)} min, plus{" "}
          {Math.round(heartbeat.graceSeconds / 60)} min of grace.
        </p>
      )}
      {source.lastError && <p className="text-[0.8125rem] text-danger">{source.lastError}</p>}
    </li>
  )
}
