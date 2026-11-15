import { Suspense } from "react"
import type { Metadata } from "next"
import { PublicStatusPage } from "@/features/status"

export const metadata: Metadata = { title: "Status" }

export const instant = false

export default function Page({ params }: PageProps<"/status/[slug]">) {
  return (
    <Suspense>
      <PublicStatusPage params={params} />
    </Suspense>
  )
}
