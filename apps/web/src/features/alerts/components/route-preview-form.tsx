"use client"

import * as React from "react"
import { Badge, Button, Field, Spinner, Textarea } from "@/components/ui"
import { usePreviewRoute } from "../hooks"

interface RoutePreviewFormProps {
  workspaceId: string
  sourceId: string
}

export function RoutePreviewForm({ workspaceId, sourceId }: RoutePreviewFormProps) {
  const [text, setText] = React.useState("")
  const [parseError, setParseError] = React.useState<string | null>(null)
  const preview = usePreviewRoute(workspaceId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload: unknown = JSON.parse(text)
      setParseError(null)
      preview.mutate({ sourceId, payload })
    } catch {
      setParseError("This is not valid JSON")
    }
  }

  const result = preview.data
  return (
    <form onSubmit={onSubmit} className="grid gap-2 border border-line p-3">
      <Field
        label="Which route would this payload match?"
        htmlFor={`preview-${sourceId}`}
        error={parseError ?? undefined}
        help="Paste a sample payload. Nothing is stored."
      >
        <Textarea
          id={`preview-${sourceId}`}
          rows={4}
          className="font-mono text-[0.75rem]"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="sm"
        className="w-fit"
        disabled={!text.trim() || preview.isPending}
      >
        {preview.isPending && <Spinner />} Preview
      </Button>
      {result?.error && <p className="text-[0.8125rem] text-danger">{result.error}</p>}
      {result && !result.error && (
        <ul className="grid gap-1 text-[0.8125rem]">
          {result.alerts.map((alert) => (
            <li key={alert.dedupKey} className="flex flex-wrap items-center gap-2">
              <Badge variant={alert.status === "firing" ? "destructive" : "success"}>
                {alert.status}
              </Badge>
              <span className="font-medium">{alert.title}</span>
              <span className="text-muted-foreground">
                {alert.route
                  ? `matches "${alert.route.name}"${alert.createsIncident ? ", opens an incident" : ""}`
                  : "matches no route, only recorded"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
