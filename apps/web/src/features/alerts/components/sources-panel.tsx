"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { TokenSecretNotice } from "@/features/integrations"
import { useAlertSources, useDeleteSource, useRotateSource } from "../hooks"
import type { AlertSourceWithToken } from "../schemas"
import { SourceCreateDialog } from "./source-create-dialog"
import { SourceRow } from "./source-row"

interface SourcesPanelProps {
  workspaceId: string
  canManage: boolean
  heartbeats: boolean
}

export function SourcesPanel({ workspaceId, canManage, heartbeats }: SourcesPanelProps) {
  const sources = useAlertSources(workspaceId)
  const rotate = useRotateSource(workspaceId)
  const remove = useDeleteSource(workspaceId)
  const [secret, setSecret] = React.useState<AlertSourceWithToken | null>(null)
  const pending = rotate.isPending || remove.isPending

  const items = (sources.data ?? []).filter((item) => (item.kind === "heartbeat") === heartbeats)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          {heartbeats
            ? "A heartbeat is a URL your scheduled job calls when it runs. A missing call opens an alert."
            : "A source is a tool that sends alerts to Pramaan, like Prometheus, Sentry or Grafana."}
        </p>
        {canManage && (
          <SourceCreateDialog
            workspaceId={workspaceId}
            fixedKind={heartbeats ? "heartbeat" : undefined}
            triggerLabel={heartbeats ? "New heartbeat" : "New source"}
            onCreated={setSecret}
          />
        )}
      </div>
      {secret && (
        <div className="grid gap-2">
          <TokenSecretNotice token={secret.token} />
          <p className="font-mono text-[0.75rem] break-all text-muted-foreground">
            {secret.kind === "heartbeat"
              ? `curl -fsS "${secret.url}?token=${secret.token}"`
              : `Send alerts to ${secret.url} with the header  Authorization: Bearer ${secret.token}`}
          </p>
        </div>
      )}
      {sources.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          {heartbeats ? "No heartbeats yet." : "No sources yet."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              canManage={canManage}
              pending={pending}
              onRotate={(id) => rotate.mutate(id, { onSuccess: setSecret })}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
