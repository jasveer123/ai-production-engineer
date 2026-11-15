import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SubscriptionResultPage } from "@/features/status"

export const metadata: Metadata = { title: "Status updates" }

export const instant = false

export default async function Page({ params }: PageProps<"/status-subscription/[action]">) {
  const { action } = await params
  if (action !== "confirm" && action !== "unsubscribe") notFound()

  return (
    <Suspense>
      <SubscriptionResultPage action={action} />
    </Suspense>
  )
}
