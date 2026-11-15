"use client"

import * as React from "react"
import { Button, Spinner, Textarea } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { usePostMortem } from "../hooks"
import type { Incident } from "../schemas"

interface PostMortemEditorProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

export function PostMortemEditor({ workspaceId, incident, canAct }: PostMortemEditorProps) {
  const [body, setBody] = React.useState(incident.postMortem ?? "")
  const save = usePostMortem(workspaceId, incident.id)
  const dirty = body !== (incident.postMortem ?? "")

  return (
    <section aria-label="Post-mortem" className="grid gap-3 border border-line bg-panel p-5">
      <header className="grid gap-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Post-mortem</h2>
        <p className="text-sm text-muted-foreground">
          {incident.postMortemUpdatedAt
            ? `Last saved ${formatDateTime(incident.postMortemUpdatedAt)}. It also shows on the timeline.`
            : "Write what happened, the impact, the root cause and the follow-ups. Markdown is kept as written."}
        </p>
      </header>
      <Textarea
        aria-label="Post-mortem"
        value={body}
        readOnly={!canAct}
        rows={10}
        maxLength={100000}
        onChange={(e) => setBody(e.target.value)}
        placeholder={"## Summary\n\n## Impact\n\n## Root cause\n\n## Follow-ups"}
        className="font-mono"
      />
      {canAct && (
        <Button
          size="sm"
          className="w-fit"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(body)}
        >
          {save.isPending && <Spinner />} Save post-mortem
        </Button>
      )}
    </section>
  )
}
