import { z } from "zod"

export const PASSWORD_MIN = 12

export const loginSchema = z.object({
  email: z.string().min(1, "Enter your work email.").email("That email does not look right."),
  password: z.string().min(1, "Enter your password."),
})
export type LoginValues = z.infer<typeof loginSchema>

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().min(1, "Enter your work email.").email("That email does not look right."),
  workspace: z.string().trim().min(2, "Give your workspace a name."),
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`),
  terms: z.boolean().refine((v) => v, "Please accept the terms to continue."),
})
export type SignUpValues = z.infer<typeof signUpSchema>

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    emailVerified: z.boolean(),
    hasPassword: z.boolean(),
  }),
  workspaces: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
  authProviders: z.object({
    password: z.boolean(),
    github: z.boolean(),
    slack: z.boolean(),
    devLogin: z.boolean(),
  }),
})
export type Session = z.infer<typeof sessionSchema>

export type LoginRequest = Pick<LoginValues, "email" | "password">
export interface RegisterRequest {
  name: string
  email: string
  password: string
  workspaceName: string
}

export interface ResendVerificationRequest {
  email: string
}

export const providersSchema = sessionSchema.shape.authProviders
export type Providers = z.infer<typeof providersSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Enter your work email.").email("That email does not look right."),
})
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`),
    confirm: z.string().min(1, "Type the new password again."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface VerifyEmailRequest {
  token: string
}
