"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button, Spinner } from "@/components/ui"
import { getErrorMessage } from "@/lib/api"
import { QUERY_PARAM } from "@/lib/constants/query-params"
import { ROUTES } from "@/lib/constants/routes"
import { useVerifyEmail } from "../hooks"
import { AuthErrorAlert } from "./auth-error-alert"
import { AuthFormCard } from "./auth-form-card"

export function VerifyEmailStatus() {
  const router = useRouter()
  const token = useSearchParams().get(QUERY_PARAM.TOKEN)
  const { mutate, isError, error } = useVerifyEmail()
  const requested = React.useRef(false)

  React.useEffect(() => {
    if (token && !requested.current) {
      requested.current = true
      mutate({ token }, { onSuccess: () => router.replace(ROUTES.dashboard) })
    }
  }, [token, mutate, router])

  const failed = !token || isError

  return (
    <AuthFormCard
      title="Confirm your email"
      subtitle={failed ? "We could not use this link." : "One moment while we check your link."}
    >
      {!failed && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner /> Checking your link, then signing you in
        </div>
      )}
      {!token && (
        <AuthErrorAlert
          title="This link is incomplete"
          message="Open the link from your email again."
        />
      )}
      {isError && (
        <AuthErrorAlert title="Could not confirm your email" message={getErrorMessage(error)} />
      )}
      {failed && (
        <Button nativeButton={false} render={<Link href={ROUTES.login} />} className="w-full">
          Back to sign in
        </Button>
      )}
    </AuthFormCard>
  )
}
