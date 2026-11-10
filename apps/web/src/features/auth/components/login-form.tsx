"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Field, Input, Spinner } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { API_ERROR_CODE } from "@/lib/api/config"
import { OAUTH_PROVIDER_LABEL, type OAuthProvider } from "@/lib/constants/auth"
import { QUERY_PARAM } from "@/lib/constants/query-params"
import { ROUTES } from "@/lib/constants/routes"
import { savePendingEmail } from "@/lib/storage/pending-email"
import { useLogin } from "../hooks"
import { loginSchema, type LoginValues } from "../schemas"
import { AuthErrorAlert } from "./auth-error-alert"
import { AuthFormCard, OrDivider } from "./auth-form-card"
import { SocialAuthButtons } from "./social-auth-buttons"

export function LoginForm() {
  const router = useRouter()
  const oauthError = useSearchParams().get(QUERY_PARAM.ERROR) as OAuthProvider | null
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit((values) =>
    login.mutateAsync(values).then(
      () => router.replace(ROUTES.dashboard),
      (error: unknown) => {
        if (error instanceof ApiError && error.code === API_ERROR_CODE.EMAIL_NOT_VERIFIED) {
          savePendingEmail(values.email)
          router.push(ROUTES.checkEmail)
        }
      }
    )
  )

  return (
    <AuthFormCard
      title="Welcome back"
      subtitle="Sign in to see what your apps are doing right now."
    >
      {oauthError && OAUTH_PROVIDER_LABEL[oauthError] && (
        <AuthErrorAlert
          title={`${OAUTH_PROVIDER_LABEL[oauthError]} sign-in failed`}
          message="Try again, or sign in with your email and password."
        />
      )}
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
        <div className="grid content-start gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-[0.8125rem] leading-5 font-medium">
              Password
            </label>
            <Link
              href={ROUTES.forgotPassword}
              className="text-[0.8125rem] text-brand underline underline-offset-3 outline-none hover:text-brand-strong focus-visible:ring-3 focus-visible:ring-brand/40"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-[0.8125rem] text-danger">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Spinner className="border-on-brand/40 border-t-on-brand" />} Sign in
        </Button>
      </form>
      <OrDivider />
      <SocialAuthButtons verb="Continue" />
      <p className="text-center text-[0.8125rem] text-muted-foreground">
        New here?{" "}
        <Link
          href={ROUTES.signUp}
          className="text-brand underline underline-offset-3 hover:text-brand-strong"
        >
          Create an account
        </Link>
      </p>
    </AuthFormCard>
  )
}
