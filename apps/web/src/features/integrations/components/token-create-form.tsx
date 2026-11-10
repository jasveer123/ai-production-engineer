"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button, Input, Spinner } from "@/components/ui"
import { useCreateToken } from "../hooks"
import type { TokenSecret } from "../types"

interface TokenCreateFormProps {
  workspaceId: string
  platform: string
  defaultName: string
  onCreated: (secret: TokenSecret) => void
}

export function TokenCreateForm({
  workspaceId,
  platform,
  defaultName,
  onCreated,
}: TokenCreateFormProps) {
  const [name, setName] = React.useState(defaultName)
  const create = useCreateToken(workspaceId)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    create.mutate(
      { name: name.trim() || defaultName, platform },
      { onSuccess: (created) => onCreated({ id: created.id, token: created.token }) }
    )
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex gap-2">
      <Input
        aria-label="Source name"
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" disabled={create.isPending} className="shrink-0">
        {create.isPending ? <Spinner /> : <Plus />} Create source
      </Button>
    </form>
  )
}
