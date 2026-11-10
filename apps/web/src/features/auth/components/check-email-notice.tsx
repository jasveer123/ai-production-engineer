"use client"

import * as React from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from "@/components/ui"
import { useCooldown } from "@/lib/hooks/use-cooldown"
import { ROUTES } from "@/lib/constants/routes"
import { readPendingEmail } from "@/lib/storage/pending-email"
import { useResendVerification } from "../hooks"
import { AuthFormCard } from "./auth-form-card"

const RESEND_COOLDOWN_SECONDS = 30

const subscribeToNothing = () => () => undefined

export function CheckEmailNotice() {
  const email = React.useSyncExternalStore(subscribeToNothing, readPendingEmail, () => null)
  const resend = useResendVerification()
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)

  const onResend = () => {
    if (!email) return
    resend.mutate({ email }, { onSuccess: cooldown.start })
  }

  return (
    <AuthFormCard
      title="Check your email"
      subtitle="Click the link we sent you. It confirms your email and signs you in."
    >
      <Alert variant="success">
        <MailCheck />
        <AlertTitle>{email ? "Link sent" : "Open the link in your email"}</AlertTitle>
        <AlertDescription>
          {email ? `We sent it to ${email}.` : "We sent it when you signed up."} It works once and
          expires in 48 hours.
        </AlertDescription>
      </Alert>
      {email && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onResend}
          disabled={resend.isPending || cooldown.remaining > 0}
        >
          {resend.isPending && <Spinner />}
          {cooldown.remaining > 0 ? `Send again in ${cooldown.remaining}s` : "Send the link again"}
        </Button>
      )}
      <p className="text-center text-[0.8125rem] text-muted-foreground">
        <Link
          href={ROUTES.signUp}
          className="text-brand underline underline-offset-3 hover:text-brand-strong"
        >
          Use a different email
        </Link>
        {" · "}
        <Link
          href={ROUTES.login}
          className="text-brand underline underline-offset-3 hover:text-brand-strong"
        >
          Back to sign in
        </Link>
      </p>
    </AuthFormCard>
  )
}
