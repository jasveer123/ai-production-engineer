"use client"

import * as React from "react"
import { Button, Chip, DrawerFooter, Eyebrow, Field, Input, Spinner } from "@/components/ui"
import { TOKEN_AREAS, TOKEN_EXPIRIES, TOKEN_SCOPES } from "../constants"
import { useCreateApiToken } from "../hooks"

interface ApiTokenFormProps {
  workspaceId: string
  onCreated: (token: string) => void
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export function ApiTokenForm({ workspaceId, onCreated }: ApiTokenFormProps) {
  const create = useCreateApiToken()
  const [name, setName] = React.useState("")
  const [days, setDays] = React.useState<number>(90)
  const [scopes, setScopes] = React.useState<string[]>(["read"])
  const [areas, setAreas] = React.useState<string[]>([])
  const valid = name.trim() && scopes.length > 0

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    create.mutate(
      { name: name.trim(), workspaceId, scopes, areas, expiresInDays: days },
      { onSuccess: (result) => onCreated(result.token) }
    )
  }

  return (
    <form method="post" className="grid gap-4" onSubmit={onSubmit}>
      <Field label="Name" htmlFor="token-name">
        <Input
          id="token-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deploy script"
        />
      </Field>
      <div className="grid gap-2">
        <Eyebrow>Allowed to</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {TOKEN_SCOPES.map((item) => (
            <Chip
              key={item.value}
              type="button"
              selected={scopes.includes(item.value)}
              onClick={() => setScopes((list) => toggle(list, item.value))}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <p className="text-[0.75rem] text-muted-foreground">
          Ingest only can send alert events and heartbeat pings, nothing else.
        </p>
      </div>
      <div className="grid gap-2">
        <Eyebrow>Areas</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {TOKEN_AREAS.map((item) => (
            <Chip
              key={item.value}
              type="button"
              selected={areas.includes(item.value)}
              onClick={() => setAreas((list) => toggle(list, item.value))}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <p className="text-[0.75rem] text-muted-foreground">
          {areas.length === 0
            ? "None picked: every area of this workspace."
            : "Only the picked areas."}
        </p>
      </div>
      <div className="grid gap-2">
        <Eyebrow>Expires after</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {TOKEN_EXPIRIES.map((item) => (
            <Chip
              key={item.days}
              type="button"
              selected={days === item.days}
              onClick={() => setDays(item.days)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <DrawerFooter>
        <Button type="submit" disabled={!valid || create.isPending}>
          {create.isPending && <Spinner />} Create token
        </Button>
      </DrawerFooter>
    </form>
  )
}
