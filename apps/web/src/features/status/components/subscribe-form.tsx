"use client"

import * as React from "react"
import { Button, Input, Spinner } from "@/components/ui"
import { useSubscribe } from "../hooks"

interface SubscribeFormProps {
  slug: string
}

export function SubscribeForm({ slug }: SubscribeFormProps) {
  const subscribe = useSubscribe(slug)
  const [email, setEmail] = React.useState("")

  if (subscribe.isSuccess) {
    return (
      <p className="border border-line bg-panel p-4 text-sm">
        Check your inbox. Click the link we sent to start getting updates.
      </p>
    )
  }

  return (
    <form
      method="post"
      className="flex flex-wrap items-center gap-2 border border-line bg-panel p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (email.trim()) subscribe.mutate(email.trim())
      }}
    >
      <span className="text-sm font-medium">Get updates by email</span>
      <Input
        aria-label="Your email"
        type="email"
        className="w-64"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
      />
      <Button type="submit" size="sm" disabled={!email.trim() || subscribe.isPending}>
        {subscribe.isPending && <Spinner />} Subscribe
      </Button>
      {subscribe.isError && (
        <span className="text-[0.8125rem] text-danger">
          That email address does not look right.
        </span>
      )}
    </form>
  )
}
