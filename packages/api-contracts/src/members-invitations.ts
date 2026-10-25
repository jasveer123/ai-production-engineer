import { z } from 'zod';
import { Role, roleSchema } from './common';

export const inviteMemberSchema = z.object({ email: z.string().email(), role: roleSchema });
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({ role: roleSchema });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string | null;
}

/** Returned once when an invitation is created or re-sent. The link is never shown again. */
export interface InvitationWithLink extends Invitation {
  inviteUrl: string;
}
