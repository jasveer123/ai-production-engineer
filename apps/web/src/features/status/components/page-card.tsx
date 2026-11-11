"use client"

import { X } from "lucide-react"
import { Badge, Button, Chip, Eyebrow } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useMonitors } from "@/features/monitors"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useDeletePage, useRemoveUpdate, useSetMonitors } from "../hooks"
import type { StatusPage } from "../schemas"
import { DomainPanel } from "./domain-panel"
import { UpdateForm } from "./update-form"

interface PageCardProps {
  workspaceId: string
  page: StatusPage
  canManage: boolean
  canPost: boolean
}

export function PageCard({ workspaceId, page, canManage, canPost }: PageCardProps) {
  const monitors = useMonitors(workspaceId)
  const setMonitors = useSetMonitors(workspaceId)
  const remove = useDeletePage(workspaceId)
  const removeUpdate = useRemoveUpdate(workspaceId, page.id)
  const toggle = (id: string) =>
    setMonitors.mutate({
      id: page.id,
      monitorIds: page.monitorIds.includes(id)
        ? page.monitorIds.filter((m) => m !== id)
        : [...page.monitorIds, id],
    })

  return (
    <article className="grid gap-5 border border-line bg-panel p-5" aria-label={page.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-heading text-lg font-semibold">{page.name}</h2>
          <a
            href={`/status/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.75rem] text-brand-strong hover:underline"
          >
            /status/{page.slug}
          </a>
          <span className="text-[0.75rem] text-muted-foreground">
            {page.subscribers} email subscriber{page.subscribers === 1 ? "" : "s"}
          </span>
        </div>
        {canManage && (
          <ConfirmDialog
            triggerLabel="Delete"
            title={`Delete ${page.name}?`}
            description="The public address stops working. This cannot be undone."
            confirmLabel="Delete page"
            pending={remove.isPending}
            onConfirm={() => remove.mutate(page.id)}
          />
        )}
      </div>
      <div className="grid gap-2">
        <Eyebrow>Monitors on this page</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {(monitors.data ?? []).map((monitor) => (
            <Chip
              key={monitor.id}
              selected={page.monitorIds.includes(monitor.id)}
              disabled={!canManage || setMonitors.isPending}
              onClick={() => toggle(monitor.id)}
            >
              {monitor.name}
            </Chip>
          ))}
          {(monitors.data ?? []).length === 0 && (
            <span className="text-[0.8125rem] text-muted-foreground">No monitors yet.</span>
          )}
        </div>
      </div>
      {canManage && <DomainPanel workspaceId={workspaceId} page={page} />}
      {canPost && <UpdateForm workspaceId={workspaceId} pageId={page.id} />}
      {page.updates.length > 0 && (
        <ul className="grid gap-2">
          {page.updates.map((update) => (
            <li key={update.id} className="flex items-start justify-between gap-2 text-sm">
              <span className="grid gap-0.5">
                <span className="flex items-center gap-2">
                  <Badge>{update.state}</Badge>
                  <span className="font-semibold">{update.title}</span>
                  {update.auto && <Badge variant="info">automatic</Badge>}
                </span>
                <span className="text-[0.75rem] text-muted-foreground">
                  {formatRelativeTime(update.createdAt)}
                </span>
              </span>
              {canPost && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove update"
                  disabled={removeUpdate.isPending}
                  onClick={() => removeUpdate.mutate(update.id)}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
