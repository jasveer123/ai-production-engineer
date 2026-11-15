"use client"

import * as React from "react"
import { Badge, Button, Chip, CodeBlock, Eyebrow, Input } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { PLATFORMS } from "../constants"
import { useRemoveErrorApp, useUpdateErrorApp } from "../hooks"
import { SNIPPET_KINDS, sentrySnippet, type SnippetKind } from "../lib"
import type { ErrorApp } from "../schemas"

interface ErrorAppCardProps {
  workspaceId: string
  app: ErrorApp
  canManage: boolean
}

const defaultKind = (platform: string): SnippetKind =>
  platform === "python" ? "python" : platform === "node" ? "node" : "browser"

export function ErrorAppCard({ workspaceId, app, canManage }: ErrorAppCardProps) {
  const [kind, setKind] = React.useState<SnippetKind>(defaultKind(app.platform))
  const [limit, setLimit] = React.useState(String(app.rateLimitPerMinute))
  const update = useUpdateErrorApp(workspaceId)
  const remove = useRemoveErrorApp(workspaceId)
  const platform = PLATFORMS.find((p) => p.value === app.platform)?.label ?? app.platform
  const parsed = Number(limit)

  return (
    <article className="grid gap-4 border border-line bg-panel p-4" aria-label={app.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{app.name}</h2>
          <Badge>{platform}</Badge>
          {app.droppedEvents > 0 && (
            <Badge variant="warning">
              {app.droppedEvents.toLocaleString()} dropped by spike protection
            </Badge>
          )}
        </div>
        <span className="text-[0.8125rem] text-muted-foreground">
          {app.lastEventAt ? `Last event ${formatRelativeTime(app.lastEventAt)}` : "No events yet"}
        </span>
      </div>
      <div className="grid gap-2">
        <Eyebrow>DSN</Eyebrow>
        <CodeBlock aria-label={`${app.name} DSN`}>{app.dsn}</CodeBlock>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Set up the Sentry SDK</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {SNIPPET_KINDS.map((item) => (
              <Chip
                key={item.value}
                selected={kind === item.value}
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>
        <CodeBlock>{sentrySnippet(kind, app.dsn)}</CodeBlock>
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => void navigator.clipboard?.writeText(sentrySnippet(kind, app.dsn))}
        >
          Copy snippet
        </Button>
      </div>
      {canManage && (
        <form
          method="post"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (parsed >= 1) update.mutate({ id: app.id, rateLimitPerMinute: parsed })
          }}
        >
          <label className="grid gap-1 text-[0.8125rem]" htmlFor={`limit-${app.id}`}>
            Spike protection: most events kept per minute
            <Input
              id={`limit-${app.id}`}
              type="number"
              min={1}
              max={100000}
              className="w-40"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!(parsed >= 1) || update.isPending}
          >
            Save limit
          </Button>
          <span className="ml-auto">
            <ConfirmDialog
              triggerLabel="Delete"
              title={`Delete ${app.name}?`}
              description="Its DSN stops accepting events. Errors already grouped stay."
              confirmLabel="Delete application"
              pending={remove.isPending}
              onConfirm={() => remove.mutate(app.id)}
            />
          </span>
        </form>
      )}
    </article>
  )
}
