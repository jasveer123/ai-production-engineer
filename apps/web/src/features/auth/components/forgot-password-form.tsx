"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Button, Field, Input, Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { useForgotPassword } from "../hooks"
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas"
import { AuthFormCard } from "./auth-form-card"

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = handleSubmit((values) =>
    forgotPassword.mutateAsync(values).catch(() => undefined)
  )

  return (
    <AuthFormCard
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to set a new one."
    >
      {forgotPassword.isSuccess ? (
        <Alert variant="success">
          <MailCheck />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account uses that email, a reset link is on its way. It works once and expires in
            30 minutes.
          </AlertDescription>
        </Alert>
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Work email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending && (
              <Spinner className="border-on-brand/40 border-t-on-brand" />
            )}{" "}
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-center text-[0.8125rem] text-muted-foreground">
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
