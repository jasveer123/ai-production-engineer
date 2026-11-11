"use client"

import { Badge, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useRumUsers } from "../hooks"

interface UsersPanelProps {
  workspaceId: string
  appId: string
  minutes: number
  onPick: (userId: string) => void
}

export function UsersPanel({ workspaceId, appId, minutes, onPick }: UsersPanelProps) {
  const users = useRumUsers(workspaceId, appId, minutes)

  if (users.isPending) return <Spinner className="size-5" />
  const items = users.data ?? []

  return items.length === 0 ? (
    <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
      No identified users yet. Call <span className="font-mono">pramaan.identify</span> after sign
      in.
    </p>
  ) : (
    <ul className="grid gap-2">
      {items.map((u) => (
        <li key={u.userId}>
          <button
            type="button"
            onClick={() => onPick(u.userId)}
            className="flex w-full flex-wrap items-center justify-between gap-2 border border-line bg-panel p-4 text-left hover:bg-panel-2"
          >
            <span className="grid">
              <span className="font-medium">{u.name ?? u.email ?? u.userId}</span>
              {(u.name || u.email) && (
                <span className="text-[0.8125rem] text-muted-foreground">
                  {u.email ?? u.userId}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              {u.errors > 0 && <Badge variant="destructive">{u.errors} errors</Badge>}
              {u.sessions} sessions · {formatRelativeTime(u.lastSeenAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
