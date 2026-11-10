"use client"

import { ExternalLink } from "lucide-react"
import { Badge, Spinner } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { TIMELINE_KIND_LABEL } from "../constants"
import { useTimeline } from "../hooks"
import { shortSha } from "../lib"

interface TimelineListProps {
  workspaceId: string
  incidentId: string
}

export function TimelineList({ workspaceId, incidentId }: TimelineListProps) {
  const timeline = useTimeline(workspaceId, incidentId)

  if (timeline.isPending) return <Spinner />

  const entries = [...(timeline.data ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1))

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nothing has happened on this incident yet.</p>
    )
  }

  return (
    <ol className="grid gap-0 border-l border-line pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative grid gap-1 pb-5">
          <span className="absolute top-1.5 -left-[1.5rem] size-2 bg-brand" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={entry.kind === "error" ? "destructive" : "default"}>
              {TIMELINE_KIND_LABEL[entry.kind] ?? entry.kind}
            </Badge>
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {formatDateTime(entry.at)} · {entry.source}
              {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
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
          </div>
          {entry.summary && <p className="text-sm leading-6">{entry.summary}</p>}
          {entry.kind === "deploy" && entry.commitSha && (
            <p className="font-mono text-[0.75rem] text-muted-foreground">
              {shortSha(entry.commitSha)}
              {entry.version ? ` · ${entry.version}` : ""}
              {entry.environment ? ` · ${entry.environment}` : ""}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
