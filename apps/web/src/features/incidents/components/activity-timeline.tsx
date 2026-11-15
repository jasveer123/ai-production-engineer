"use client"

import { Button, Spinner } from "@/components/ui"
import { useActivity, useComments } from "../hooks"
import { ActivityItem } from "./activity-item"
import { CommentComposer } from "./comment-composer"

interface ActivityTimelineProps {
  workspaceId: string
  incidentId: string
  canAct: boolean
}

export function ActivityTimeline({ workspaceId, incidentId, canAct }: ActivityTimelineProps) {
  const activity = useActivity(workspaceId, incidentId)
  const comments = useComments(workspaceId, incidentId)
  const entries = activity.data?.pages.flatMap((page) => page.entries) ?? []
  const busy = comments.edit.isPending || comments.remove.isPending

  if (activity.isPending) return <Spinner />

  return (
    <div className="grid gap-4">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has happened on this incident yet.</p>
      ) : (
        <ol className="grid gap-0 border-l border-line pl-5">
          {entries.map((entry) => (
            <ActivityItem
              key={entry.id}
              entry={entry}
              pending={busy}
              onEdit={(body) => comments.edit.mutate({ commentId: entry.id, body })}
              onDelete={() => comments.remove.mutate(entry.id)}
            />
          ))}
        </ol>
      )}
      {activity.hasNextPage && (
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={activity.isFetchingNextPage}
          onClick={() => activity.fetchNextPage()}
        >
          {activity.isFetchingNextPage && <Spinner />} Load later events
        </Button>
      )}
      {canAct && (
        <CommentComposer
          submitLabel="Post"
          pending={comments.create.isPending}
          onSubmit={(body) => comments.create.mutate(body)}
        />
      )}
    </div>
  )
}
