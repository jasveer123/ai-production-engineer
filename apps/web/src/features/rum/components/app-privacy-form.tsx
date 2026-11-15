"use client"

import * as React from "react"
import { Button, Eyebrow, Input, Spinner, Switch, Textarea } from "@/components/ui"
import { useUpdateRumApp } from "../hooks"
import type { RumApp } from "../schemas"

interface AppPrivacyFormProps {
  workspaceId: string
  app: RumApp
  canManage: boolean
}

export function AppPrivacyForm({ workspaceId, app, canManage }: AppPrivacyFormProps) {
  const update = useUpdateRumApp(workspaceId)
  const [replay, setReplay] = React.useState(app.settings.replayEnabled)
  const [rate, setRate] = React.useState(String(Math.round(app.settings.replaySampleRate * 100)))
  const [mask, setMask] = React.useState(app.settings.maskAllText)
  const [blocked, setBlocked] = React.useState(app.settings.blockSelectors.join("\n"))
  const percent = Number(rate)
  const valid = percent >= 0 && percent <= 100

  return (
    <form
      method="post"
      className="grid gap-3 border border-line p-3"
      aria-label={`${app.name} privacy`}
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        update.mutate({
          id: app.id,
          replayEnabled: replay,
          replaySampleRate: percent / 100,
          maskAllText: mask,
          blockSelectors: blocked
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 50),
        })
      }}
    >
      <Eyebrow>Privacy and replay</Eyebrow>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={replay} onCheckedChange={setReplay} disabled={!canManage} />
        Record session replays
      </label>
      <label className="grid gap-1 text-[0.8125rem]" htmlFor={`rate-${app.id}`}>
        Share of sessions to replay (%)
        <Input
          id={`rate-${app.id}`}
          type="number"
          min={0}
          max={100}
          className="w-28"
          value={rate}
          disabled={!canManage || !replay}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={mask} onCheckedChange={setMask} disabled={!canManage} />
        Hide all page text in replays
      </label>
      <label className="grid gap-1 text-[0.8125rem]" htmlFor={`block-${app.id}`}>
        Never record these elements (one CSS selector per line)
        <Textarea
          id={`block-${app.id}`}
          rows={3}
          value={blocked}
          disabled={!canManage}
          onChange={(e) => setBlocked(e.target.value)}
          placeholder=".payment-form"
        />
      </label>
      <p className="text-[0.75rem] text-muted-foreground">
        Form values are never recorded. Secret URL parameters are replaced before data leaves the
        page, and the server removes form values and hidden text again on arrival.
      </p>
      {canManage && (
        <Button type="submit" size="sm" className="w-fit" disabled={!valid || update.isPending}>
          {update.isPending && <Spinner />} Save privacy settings
        </Button>
      )}
    </form>
  )
}
