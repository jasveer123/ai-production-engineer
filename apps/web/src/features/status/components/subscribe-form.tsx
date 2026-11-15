"use client"

import * as React from "react"
import { Button, Input, Spinner } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { useSubscribe } from "../hooks"

interface SubscribeFormProps {
  slug: string
}

export function SubscribeForm({ slug }: SubscribeFormProps) {
  const subscribe = useSubscribe(slug)
  const [email, setEmail] = React.useState("")
  const limited = subscribe.error instanceof ApiError && subscribe.error.status === 429

  if (subscribe.isSuccess) {
    return (
      <p className="border border-line bg-panel p-4 text-sm" role="status">
        If this address can receive updates, a confirmation link is on its way. It expires in 24
        hours.
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
        <span className="text-[0.8125rem] text-danger" role="alert">
          {limited
            ? "Too many attempts. Try again later."
            : "That email address does not look right."}
        </span>
      )}
    </form>
  )
}
