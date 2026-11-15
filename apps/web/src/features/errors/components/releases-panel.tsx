"use client"

import { Badge, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useReleases } from "../hooks"

interface ReleasesPanelProps {
  workspaceId: string
}

export function ReleasesPanel({ workspaceId }: ReleasesPanelProps) {
  const releases = useReleases(workspaceId)

  if (releases.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  const items = releases.data ?? []

  return items.length === 0 ? (
    <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
      No releases yet. Send a release (or service version) with your errors and they are grouped
      here.
    </p>
  ) : (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.release} className="grid gap-1 border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold">{item.release}</span>
            {item.newErrors > 0 && <Badge variant="destructive">{item.newErrors} new</Badge>}
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">
            {item.events.toLocaleString()} events across {item.errors} errors · first seen{" "}
            {formatRelativeTime(item.firstAt)} · last seen {formatRelativeTime(item.lastAt)}
          </p>
        </li>
      ))}
    </ul>
  )
}
