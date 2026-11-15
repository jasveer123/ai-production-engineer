"use client"

import * as React from "react"
import { Button, Chip, Eyebrow, Field, Input, Spinner, Switch, Textarea } from "@/components/ui"
import { UPDATE_STATES } from "../constants"
import { useCreateReport } from "../hooks"
import type { AffectedDraft } from "../requests"
import { AffectedPicker } from "./affected-picker"

interface ReportComposerProps {
  workspaceId: string
  pageId: string
  resources: { id: string; publicName: string }[]
}

export function ReportComposer({ workspaceId, pageId, resources }: ReportComposerProps) {
  const create = useCreateReport(workspaceId, pageId)
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [state, setState] = React.useState<string>("investigating")
  const [affected, setAffected] = React.useState<AffectedDraft[]>([])
  const [publishAt, setPublishAt] = React.useState("")
  const [notify, setNotify] = React.useState(true)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    create.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        state,
        affected,
        publishedAt: publishAt ? new Date(publishAt).toISOString() : undefined,
        notifySubscribers: notify,
      },
      {
        onSuccess: () => {
          setTitle("")
          setBody("")
          setAffected([])
          setPublishAt("")
        },
      }
    )
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-4 border border-line bg-panel p-4">
      <Eyebrow>New status update</Eyebrow>
      <Field label="Title" htmlFor="report-title">
        <Input
          id="report-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Checkout is slow for some customers"
        />
      </Field>
      <Field label="Message" htmlFor="report-body">
        <Textarea
          id="report-body"
          value={body}
          maxLength={2000}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What customers should know"
        />
      </Field>
      <div className="flex flex-wrap gap-2" role="group" aria-label="State">
        {UPDATE_STATES.map((item) => (
          <Chip key={item} selected={state === item} onClick={() => setState(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <AffectedPicker resources={resources} value={affected} onChange={setAffected} />
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label="Publish at (optional)"
          htmlFor="report-publish"
          help="Leave empty to publish now"
        >
          <Input
            id="report-publish"
            type="datetime-local"
            className="w-60"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-[0.8125rem]">
          <Switch checked={notify} onCheckedChange={setNotify} />
          Email subscribers
        </label>
      </div>
      <Button type="submit" className="w-fit" disabled={!title.trim() || create.isPending}>
        {create.isPending && <Spinner />} Publish update
      </Button>
    </form>
  )
}
