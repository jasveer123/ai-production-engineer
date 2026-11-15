import { Suspense } from "react"
import type { Metadata } from "next"
import { PublicDomainPage } from "@/features/status"

export const metadata: Metadata = { title: "Status" }

export const instant = false

export default function Page({ params }: PageProps<"/status/by-domain/[host]">) {
  return (
    <Suspense>
      <PublicDomainPage params={params} />
    </Suspense>
  )
}
