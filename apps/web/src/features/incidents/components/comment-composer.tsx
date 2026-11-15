"use client"

import * as React from "react"
import { Button, Spinner, Textarea } from "@/components/ui"

interface CommentComposerProps {
  initial?: string
  submitLabel: string
  pending: boolean
  onSubmit: (body: string) => void
  onCancel?: () => void
}

export function CommentComposer({
  initial = "",
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const [body, setBody] = React.useState(initial)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!body.trim()) return
    onSubmit(body.trim())
    if (!onCancel) setBody("")
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Textarea
        aria-label="Comment"
        placeholder="Add a comment for the team"
        value={body}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!body.trim() || pending}>
          {pending && <Spinner />} {submitLabel}
        </Button>
      </div>
    </form>
  )
}
