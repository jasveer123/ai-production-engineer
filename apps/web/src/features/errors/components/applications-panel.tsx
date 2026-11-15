"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button, Chip, Input, Spinner } from "@/components/ui"
import { PLATFORMS } from "../constants"
import { useCreateErrorApp, useErrorApps } from "../hooks"
import { ErrorAppCard } from "./error-app-card"

interface ApplicationsPanelProps {
  workspaceId: string
  canManage: boolean
}

export function ApplicationsPanel({ workspaceId, canManage }: ApplicationsPanelProps) {
  const apps = useErrorApps(workspaceId)
  const create = useCreateErrorApp(workspaceId)
  const [name, setName] = React.useState("")
  const [platform, setPlatform] = React.useState<string>("javascript")

  return (
    <div className="grid gap-6">
      <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
        Each application has a DSN. Point the unmodified Sentry SDK at it and errors are grouped
        here with stack traces, breadcrumbs, users and releases.
      </p>
      {canManage && (
        <form
          method="post"
          className="grid gap-3 border border-line p-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim())
              create.mutate({ name: name.trim(), platform }, { onSuccess: () => setName("") })
          }}
        >
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((item) => (
              <Chip
                key={item.value}
                selected={platform === item.value}
                onClick={() => setPlatform(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Application name"
              className="w-64"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkout web app"
            />
            <Button type="submit" size="sm" disabled={!name.trim() || create.isPending}>
              {create.isPending ? <Spinner /> : <Plus />} Add application
            </Button>
          </div>
        </form>
      )}
      {apps.isPending ? (
        <Spinner className="size-5" />
      ) : (apps.data ?? []).length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No applications yet. Add one to get a DSN.
        </p>
      ) : (
        (apps.data ?? []).map((app) => (
          <ErrorAppCard key={app.id} workspaceId={workspaceId} app={app} canManage={canManage} />
        ))
      )}
    </div>
  )
}
