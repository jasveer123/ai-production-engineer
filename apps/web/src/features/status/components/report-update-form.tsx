"use client"

import * as React from "react"
import { Button, Chip, Spinner, Switch, Textarea } from "@/components/ui"
import { UPDATE_STATES } from "../constants"
import type { ReportUpdateRequest } from "../requests"

interface ReportUpdateFormProps {
  current: string
  pending: boolean
  onSubmit: (body: ReportUpdateRequest, done: () => void) => void
}

export function ReportUpdateForm({ current, pending, onSubmit }: ReportUpdateFormProps) {
  const [body, setBody] = React.useState("")
  const [state, setState] = React.useState(current)
  const [notify, setNotify] = React.useState(true)

  return (
    <form
      method="post"
      className="grid gap-2 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (body.trim())
          onSubmit({ body: body.trim(), state, notifySubscribers: notify }, () => setBody(""))
      }}
    >
      <Textarea
        aria-label="Update message"
        rows={2}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an update to this thread"
      />
      <div className="flex flex-wrap items-center gap-2">
        {UPDATE_STATES.map((item) => (
          <Chip key={item} selected={state === item} onClick={() => setState(item)}>
            {item}
          </Chip>
        ))}
        <label className="flex items-center gap-2 text-[0.8125rem]">
          <Switch size="sm" checked={notify} onCheckedChange={setNotify} />
          Email subscribers
        </label>
        <Button type="submit" size="sm" className="ml-auto" disabled={!body.trim() || pending}>
          {pending && <Spinner />} Post update
        </Button>
      </div>
    </form>
  )
}
