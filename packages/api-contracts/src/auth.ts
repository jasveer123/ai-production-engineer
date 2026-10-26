import { z } from 'zod';
import { Role } from './common';

export const devLoginSchema = z.object({ email: z.string().email() });
export type DevLoginInput = z.infer<typeof devLoginSchema>;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);
const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: emailSchema,
  password: passwordSchema,
  /** From an invite link: proves the email and joins that workspace. */
  inviteToken: z.string().min(20).max(200).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export type TokenInput = z.infer<typeof tokenSchema>;

export const updateProfileSchema = z.object({ name: z.string().trim().min(1).max(100) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface Me {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    hasPassword: boolean;
  };
  workspaces: { id: string; name: string; role: Role }[];
  authProviders: { password: boolean; github: boolean; devLogin: boolean };
}

/** What an invite link points at, shown before the invitee registers or signs in. */
export interface InvitationPreview {
  email: string;
  role: Role;
  workspaceName: string;
  invitedBy: string | null;
  /** True when an account with this email already exists: sign in instead of registering. */
  accountExists: boolean;
}
