import { z } from 'zod';
import { nameSchema, type Role, type Uuid } from '../common';

export const updateProfileSchema = z.object({ name: nameSchema(100) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface Me {
  user: {
    id: Uuid;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    hasPassword: boolean;
  };
  workspaces: { id: Uuid; name: string; role: Role }[];
  authProviders: { password: boolean; github: boolean; devLogin: boolean };
}

export interface InvitationPreview {
  email: string;
  role: Role;
  workspaceName: string;
  invitedBy: string | null;
  accountExists: boolean;
}
