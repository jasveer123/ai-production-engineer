"use client"

import * as React from "react"
import { Button, Input, Spinner } from "@/components/ui"
import { usePageAccess } from "../hooks"
import type { PageLookup } from "../services"

interface PasswordGateProps {
  lookup: PageLookup
  slug: string
  name: string
}

export function PasswordGate({ lookup, slug, name }: PasswordGateProps) {
  const access = usePageAccess(lookup, slug)
  const [password, setPassword] = React.useState("")

  return (
    <main className="mx-auto grid max-w-sm gap-4 px-4 py-24">
      <h1 className="font-heading text-2xl font-semibold">{name}</h1>
      <p className="text-sm text-muted-foreground">
        This status page is private. Enter its password.
      </p>
      <form
        method="post"
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (password) access.mutate(password)
        }}
      >
        <Input
          type="password"
          aria-label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={!password || access.isPending}>
          {access.isPending && <Spinner />} Open page
        </Button>
        {access.isError && (
          <p className="text-[0.8125rem] text-danger" role="alert">
            {access.error.message}
          </p>
        )}
      </form>
    </main>
  )
}
