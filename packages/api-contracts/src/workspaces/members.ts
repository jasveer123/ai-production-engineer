import { z } from 'zod';
import { roleSchema, type IsoTimestamp, type Role, type Uuid, type WithSecret } from '../common';

export const inviteMemberSchema = z.object({ email: z.string().email(), role: roleSchema });
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({ role: roleSchema });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface Member {
  id: Uuid;
  userId: Uuid;
  email: string;
  name: string | null;
  role: Role;
  createdAt: IsoTimestamp;
}

export interface Invitation {
  id: Uuid;
  email: string;
  role: Role;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp | null;
}

export type InvitationWithLink = WithSecret<Invitation, 'inviteUrl'>;
