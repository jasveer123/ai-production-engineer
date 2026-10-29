import { z } from 'zod';
import { nameSchema } from '../common';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const longToken = z.string().min(20).max(200);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);
const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const devLoginSchema = z.object({ email: z.string().email() });
export type DevLoginInput = z.infer<typeof devLoginSchema>;

export const registerSchema = z.object({
  name: nameSchema(100, 'Enter your name'),
  email: emailSchema,
  password: passwordSchema,
  inviteToken: longToken.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ token: longToken, password: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const tokenSchema = z.object({ token: longToken });
export type TokenInput = z.infer<typeof tokenSchema>;
