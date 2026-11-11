"use client"

import { Badge, Spinner } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { useAudit } from "../hooks"

interface AuditPanelProps {
  workspaceId: string
}

export function AuditPanel({ workspaceId }: AuditPanelProps) {
  const audit = useAudit(workspaceId, true)

  if (audit.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  const items = audit.data ?? []

  return (
    <div className="grid gap-3">
      <p className="text-[0.8125rem] text-muted-foreground">
        The latest 50 changes made in this workspace, newest first.
      </p>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="grid gap-1">
          {items.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.8125rem]">{event.action}</span>
                {event.outcome !== "success" && (
                  <Badge variant="destructive">{event.outcome}</Badge>
                )}
                <span className="text-muted-foreground">{event.actorEmail ?? event.actorType}</span>
              </span>
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {formatDateTime(event.occurredAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
