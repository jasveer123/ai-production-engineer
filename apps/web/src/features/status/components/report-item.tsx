"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Badge, Button, Input } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import { STATE_LABEL, STATE_TONE } from "../constants"
import { useReportActions } from "../hooks"
import type { Report } from "../schemas"
import { ReportUpdateForm } from "./report-update-form"

interface ReportItemProps {
  workspaceId: string
  pageId: string
  report: Report
  canPost: boolean
}

export function ReportItem({ workspaceId, pageId, report, canPost }: ReportItemProps) {
  const actions = useReportActions(workspaceId, pageId, report.id)
  const [title, setTitle] = React.useState(report.title)
  const scheduled = new Date(report.publishedAt) > new Date()

  return (
    <article className="grid gap-3 border border-line bg-panel p-4" aria-label={report.title}>
      <div className="flex flex-wrap items-center gap-2">
        {canPost ? (
          <Input
            aria-label="Report title"
            className="min-w-0 flex-1 font-semibold"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() =>
              title.trim() && title !== report.title && actions.rename.mutate(title.trim())
            }
          />
        ) : (
          <h3 className="flex-1 font-semibold">{report.title}</h3>
        )}
        <Badge variant={report.resolvedAt ? "success" : "warning"}>{report.state}</Badge>
        {report.auto && <Badge variant="info">automatic</Badge>}
        {scheduled && <Badge>scheduled</Badge>}
        {canPost && (
          <ConfirmDialog
            triggerLabel="Delete"
            title="Delete this status update?"
            description="It disappears from the public page and history."
            confirmLabel="Delete"
            pending={actions.remove.isPending}
            onConfirm={() => actions.remove.mutate()}
          />
        )}
      </div>
      {report.affected.length > 0 && (
        <p className="flex flex-wrap gap-3 text-[0.75rem]">
          {report.affected.map((a) => (
            <span key={a.resourceId} className={cn("font-medium", STATE_TONE[a.impact])}>
              {a.name}: {STATE_LABEL[a.impact] ?? a.impact}
            </span>
          ))}
        </p>
      )}
      <ol className="grid gap-2">
        {report.updates.map((u) => (
          <li key={u.id} className="flex items-start justify-between gap-2 text-sm">
            <span className="grid gap-0.5">
              <span>
                <span className="font-semibold capitalize">{u.state}</span> · {u.body}
              </span>
              <span className="text-[0.75rem] text-muted-foreground">
                {formatRelativeTime(u.createdAt)}
              </span>
            </span>
            {canPost && report.updates.length > 1 && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove update"
                disabled={actions.removeUpdate.isPending}
                onClick={() => actions.removeUpdate.mutate(u.id)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {canPost && (
        <ReportUpdateForm
          current={report.state}
          pending={actions.addUpdate.isPending}
          onSubmit={(body, done) => actions.addUpdate.mutate(body, { onSuccess: done })}
        />
      )}
    </article>
  )
}
