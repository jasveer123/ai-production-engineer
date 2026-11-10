"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Field, Input, Spinner } from "@/components/ui"
import { QUERY_PARAM } from "@/lib/constants/query-params"
import { ROUTES } from "@/lib/constants/routes"
import { useResetPassword } from "../hooks"
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas"
import { AuthErrorAlert } from "./auth-error-alert"
import { AuthFormCard } from "./auth-form-card"
import { PasswordStrength } from "./password-strength"

export function ResetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get(QUERY_PARAM.TOKEN)
  const resetPassword = useResetPassword()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  })
  const password = useWatch({ control, name: "password" })

  const onSubmit = handleSubmit(({ password: next }) =>
    resetPassword.mutateAsync({ token: token ?? "", password: next }).then(
      () => router.replace(ROUTES.dashboard),
      () => undefined
    )
  )

  return (
    <AuthFormCard
      anchor="top"
      title="Choose a new password"
      subtitle="You will be signed in once it is saved."
    >
      {!token ? (
        <AuthErrorAlert
          title="This link is incomplete"
          message="Open the link from your email again, or ask for a new one."
        />
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="New password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <PasswordStrength value={password ?? ""} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
            {resetPassword.isPending && (
              <Spinner className="border-on-brand/40 border-t-on-brand" />
            )}{" "}
            Save new password
          </Button>
        </form>
      )}
      <p className="text-center text-[0.8125rem] text-muted-foreground">
        <Link
          href={ROUTES.forgotPassword}
          className="text-brand underline underline-offset-3 hover:text-brand-strong"
        >
          Send me a new link
        </Link>
      </p>
    </AuthFormCard>
  )
}
