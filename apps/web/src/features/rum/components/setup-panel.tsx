"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button, CodeBlock, Input, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useIngestOverview, useSiteOrigin } from "@/features/integrations"
import { useCreateRumApp, useRemoveRumApp, useRumApps } from "../hooks"
import { AppPrivacyForm } from "./app-privacy-form"

interface SetupPanelProps {
  workspaceId: string
  canManage: boolean
}

export function SetupPanel({ workspaceId, canManage }: SetupPanelProps) {
  const apps = useRumApps(workspaceId)
  const overview = useIngestOverview(workspaceId, false)
  const origin = useSiteOrigin()
  const create = useCreateRumApp(workspaceId)
  const remove = useRemoveRumApp(workspaceId)
  const [name, setName] = React.useState("")
  const api = overview.data?.ingestUrl ?? "https://your-api-address"

  return (
    <div className="grid gap-6">
      <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
        Add one application per website. Paste its script tag into the page head and you get
        sessions, page speed, errors and replays.
      </p>
      {canManage && (
        <form
          method="post"
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) create.mutate(name.trim(), { onSuccess: () => setName("") })
          }}
        >
          <Input
            aria-label="Application name"
            className="w-64"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing site"
          />
          <Button type="submit" size="sm" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Spinner /> : <Plus />} Add application
          </Button>
        </form>
      )}
      {(apps.data ?? []).map((app) => (
        <article
          key={app.id}
          className="grid gap-3 border border-line bg-panel p-4"
          aria-label={app.name}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">{app.name}</h2>
            {canManage && (
              <ConfirmDialog
                triggerLabel="Delete"
                title={`Delete ${app.name}?`}
                description="Its sessions, events and replays are removed. This cannot be undone."
                confirmLabel="Delete application"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(app.id)}
              />
            )}
          </div>
          <CodeBlock>{`<script async src="${origin}/rum.js" data-key="${app.appKey}" data-api="${api}"></script>`}</CodeBlock>
          <p className="text-[0.75rem] text-muted-foreground">
            Call <span className="font-mono">pramaan.identify(&#123; id, name, email &#125;)</span>{" "}
            to name users and{" "}
            <span className="font-mono">pramaan.track(&quot;name&quot;, props)</span> for custom
            events. If the Sentry SDK is on the page, its errors link to the replay.
          </p>
          <AppPrivacyForm workspaceId={workspaceId} app={app} canManage={canManage} />
        </article>
      ))}
      {(apps.data ?? []).length === 0 && (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No applications yet.
        </p>
      )}
    </div>
  )
}
