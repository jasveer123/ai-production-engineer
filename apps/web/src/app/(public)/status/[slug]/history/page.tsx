import { Suspense } from "react"
import type { Metadata } from "next"
import { PublicHistoryPage } from "@/features/status"

export const metadata: Metadata = { title: "Status history" }

export const instant = false

export default function Page({ params }: PageProps<"/status/[slug]/history">) {
  return (
    <Suspense>
      <PublicHistoryPage params={params} />
    </Suspense>
  )
}
