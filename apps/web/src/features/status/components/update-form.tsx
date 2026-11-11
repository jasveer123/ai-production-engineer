"use client"

import * as React from "react"
import { Button, Chip, Input, Spinner } from "@/components/ui"
import { UPDATE_STATES } from "../constants"
import { usePostUpdate } from "../hooks"

interface UpdateFormProps {
  workspaceId: string
  pageId: string
}

export function UpdateForm({ workspaceId, pageId }: UpdateFormProps) {
  const post = usePostUpdate(workspaceId, pageId)
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [state, setState] = React.useState<string>("investigating")

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    post.mutate(
      { title: title.trim(), body: body.trim(), state },
      {
        onSuccess: () => {
          setTitle("")
          setBody("")
        },
      }
    )
  }

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-3 border border-line p-3">
      <Input
        aria-label="Update title"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is happening?"
      />
      <textarea
        aria-label="Update details"
        value={body}
        maxLength={2000}
        rows={2}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Details for your customers (optional)"
        className="w-full resize-y border border-line-strong bg-panel px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {UPDATE_STATES.map((item) => (
            <Chip key={item} selected={state === item} onClick={() => setState(item)}>
              {item}
            </Chip>
          ))}
        </div>
        <Button type="submit" size="sm" disabled={!title.trim() || post.isPending}>
          {post.isPending && <Spinner />} Post update
        </Button>
      </div>
    </form>
  )
}
