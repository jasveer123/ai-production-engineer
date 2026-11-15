"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { useSaveMetadata } from "../hooks"

interface MetadataEditorProps {
  workspaceId: string
  incidentId: string
  metadata: Record<string, string>
  inherited: boolean
  canAct: boolean
}

export function MetadataEditor({
  workspaceId,
  incidentId,
  metadata,
  inherited,
  canAct,
}: MetadataEditorProps) {
  const [key, setKey] = React.useState("")
  const [value, setValue] = React.useState("")
  const save = useSaveMetadata(workspaceId, incidentId)
  const entries = Object.entries(metadata)

  const add = (event: React.FormEvent) => {
    event.preventDefault()
    if (!key.trim()) return
    save.mutate(
      { ...metadata, [key.trim()]: value },
      { onSuccess: () => (setKey(""), setValue("")) }
    )
  }

  const drop = (name: string) =>
    save.mutate(Object.fromEntries(entries.filter(([k]) => k !== name)))

  return (
    <div className="grid gap-2">
      {entries.length === 0 && <p className="text-muted-foreground">No metadata.</p>}
      {inherited && entries.length > 0 && (
        <p className="text-[0.75rem] text-muted-foreground">Inherited from the monitor or alert.</p>
      )}
      <ul className="grid gap-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center gap-2 font-mono text-[0.8125rem]">
            <span className="text-muted-foreground">{k}</span>
            <span className="min-w-0 truncate">{v}</span>
            {canAct && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${k}`}
                onClick={() => drop(k)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canAct && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input
            aria-label="Key"
            placeholder="key"
            value={key}
            maxLength={100}
            onChange={(e) => setKey(e.target.value)}
            className="w-40"
          />
          <Input
            aria-label="Value"
            placeholder="value"
            value={value}
            maxLength={1000}
            onChange={(e) => setValue(e.target.value)}
            className="w-56"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!key.trim() || save.isPending}
          >
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
