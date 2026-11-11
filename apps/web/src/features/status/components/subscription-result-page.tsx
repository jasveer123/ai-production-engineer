"use client"

import { useSearchParams } from "next/navigation"
import { Spinner } from "@/components/ui"
import { useSubscription } from "../hooks"

interface SubscriptionResultPageProps {
  action: "confirm" | "unsubscribe"
}

export function SubscriptionResultPage({ action }: SubscriptionResultPageProps) {
  const token = useSearchParams().get("token") ?? ""
  const result = useSubscription(action, token)

  return (
    <main className="mx-auto grid max-w-md gap-3 px-6 py-24 text-center">
      {result.isPending && token ? (
        <Spinner className="mx-auto size-6" />
      ) : result.data ? (
        <>
          <h1 className="font-heading text-2xl font-semibold">
            {action === "confirm" ? "You are subscribed" : "You are unsubscribed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {action === "confirm"
              ? `You will get an email when ${result.data.page} reports a problem.`
              : `You will no longer get emails from ${result.data.page}.`}
          </p>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-semibold">This link is not valid</h1>
          <p className="text-sm text-muted-foreground">It may have been used already.</p>
        </>
      )}
    </main>
  )
}
