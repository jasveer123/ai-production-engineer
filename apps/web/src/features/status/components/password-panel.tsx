"use client"

import * as React from "react"
import { Badge, Button, Eyebrow, Input, Spinner } from "@/components/ui"
import { useUpdatePage } from "../hooks"
import type { StatusPage } from "../schemas"

interface PasswordPanelProps {
  workspaceId: string
  page: StatusPage
}

export function PasswordPanel({ workspaceId, page }: PasswordPanelProps) {
  const update = useUpdatePage(workspaceId, page.id, "Access saved")
  const [password, setPassword] = React.useState("")
  const tooShort = password.length > 0 && password.length < 8

  return (
    <section className="grid max-w-2xl gap-2" aria-label="Password protection">
      <div className="flex items-center gap-2">
        <Eyebrow>Password protection</Eyebrow>
        <Badge variant={page.isPrivate ? "info" : "default"}>
          {page.isPrivate ? "private" : "public"}
        </Badge>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        A private page asks visitors for a password before showing anything.
      </p>
      <form
        method="post"
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (password.length >= 8)
            update.mutate({ password }, { onSuccess: () => setPassword("") })
        }}
      >
        <Input
          type="password"
          aria-label="Page password"
          autoComplete="new-password"
          className="w-64"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={page.isPrivate ? "New password" : "At least 8 characters"}
        />
        <Button type="submit" size="sm" disabled={password.length < 8 || update.isPending}>
          {update.isPending && <Spinner />} {page.isPrivate ? "Change password" : "Make private"}
        </Button>
        {page.isPrivate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ password: null })}
          >
            Make public
          </Button>
        )}
      </form>
      {tooShort && <p className="text-[0.8125rem] text-danger">Use at least 8 characters.</p>}
    </section>
  )
}
