import type { Metadata } from "next"
import { Suspense } from "react"
import { VerifyEmailStatus } from "@/features/auth"

export const metadata: Metadata = { title: "Confirm your email" }

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  )
}
