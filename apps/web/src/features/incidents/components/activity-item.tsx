"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"
import { Badge, Button, CodeBlock } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { ACTIVITY_LABEL, ACTIVITY_VARIANT } from "../constants"
import type { ActivityEntry } from "../response-schemas"
import { CommentComposer } from "./comment-composer"

interface ActivityItemProps {
  entry: ActivityEntry
  pending: boolean
  onEdit: (body: string) => void
  onDelete: () => void
}

export function ActivityItem({ entry, pending, onEdit, onDelete }: ActivityItemProps) {
  const [editing, setEditing] = React.useState(false)
  const who = entry.actor ? (entry.actor.name ?? entry.actor.email) : null
  const delivery = [entry.channel, entry.address, entry.deliveryStatus].filter(Boolean).join(" · ")

  return (
    <li className="relative grid gap-1 pb-5">
      <span className="absolute top-1.5 -left-[1.5rem] size-2 bg-brand" aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ACTIVITY_VARIANT[entry.kind] ?? "default"}>
          {ACTIVITY_LABEL[entry.kind] ?? entry.kind}
        </Badge>
        <span className="font-mono text-[0.75rem] text-muted-foreground">
          {formatDateTime(entry.at)} · {who ?? entry.source}
        </span>
        {entry.sourceUrl && (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-brand"
            aria-label="Open source"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        {entry.editable && !editing && (
          <span className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="xs" variant="ghost" disabled={pending} onClick={onDelete}>
              Delete
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <CommentComposer
          initial={entry.body ?? ""}
          submitLabel="Save"
          pending={pending}
          onSubmit={(body) => {
            onEdit(body)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : entry.kind === "post_mortem" ? (
        <CodeBlock className="font-sans whitespace-pre-wrap">{entry.body}</CodeBlock>
      ) : (
        <p className="text-sm leading-6 whitespace-pre-wrap">{entry.body ?? entry.summary}</p>
      )}
      {entry.kind === "notification" && delivery && (
        <p className="font-mono text-[0.75rem] text-muted-foreground">{delivery}</p>
      )}
    </li>
  )
}
