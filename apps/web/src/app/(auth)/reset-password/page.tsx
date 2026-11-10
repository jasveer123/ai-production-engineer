import type { Metadata } from "next"
import { Suspense } from "react"
import { ResetPasswordForm } from "@/features/auth"

export const metadata: Metadata = { title: "Choose a new password" }

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
