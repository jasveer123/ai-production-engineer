"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Checkbox, Field, Input, Label, Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { savePendingEmail } from "@/lib/storage/pending-email"
import { useSignUp } from "../hooks"
import { signUpSchema, type SignUpValues } from "../schemas"
import { AuthFormCard, OrDivider } from "./auth-form-card"
import { SocialAuthButtons } from "./social-auth-buttons"
import { PasswordStrength } from "./password-strength"

export function SignUpForm() {
  const router = useRouter()
  const signUp = useSignUp()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", workspace: "", password: "", terms: false },
  })
  const password = useWatch({ control, name: "password" })

  const onSubmit = handleSubmit((values) =>
    signUp.mutateAsync(values).then(
      (session) => {
        if (session) {
          router.replace(ROUTES.dashboard)
          return
        }
        savePendingEmail(values.email)
        router.replace(ROUTES.checkEmail)
      },
      () => undefined
    )
  )

  return (
    <AuthFormCard
      anchor="top"
      eyebrow="Step 1 of 3 · Account"
      title="Create your account"
      subtitle={
        <>
          Already have one?{" "}
          <Link
            href={ROUTES.login}
            className="text-brand underline underline-offset-3 hover:text-brand-strong"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Priya Nair"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
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
        <Field
          label="Workspace name"
          htmlFor="workspace"
          help="Usually your company or product. You can change it later."
          error={errors.workspace?.message}
        >
          <Input
            id="workspace"
            placeholder="Acme Shop"
            aria-invalid={!!errors.workspace}
            {...register("workspace")}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <PasswordStrength value={password ?? ""} />
        </Field>
        <Controller
          control={control}
          name="terms"
          render={({ field }) => (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-invalid={!!errors.terms}
                />
                <Label htmlFor="terms" className="font-normal">
                  I agree to the terms and privacy policy
                </Label>
              </div>
              {errors.terms && (
                <p className="text-[0.8125rem] text-danger">{errors.terms.message}</p>
              )}
            </div>
          )}
        />
        <Button type="submit" className="w-full" disabled={signUp.isPending}>
          {signUp.isPending && <Spinner className="border-on-brand/40 border-t-on-brand" />} Create
          account
        </Button>
      </form>
      <OrDivider />
      <SocialAuthButtons verb="Sign up" />
    </AuthFormCard>
  )
}
