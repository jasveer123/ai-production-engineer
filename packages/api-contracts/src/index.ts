import { z } from 'zod';

// Shared by the API (validation) and the web app (forms and typed responses).

export const ROLES = ['owner', 'admin', 'engineer', 'viewer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ----- Auth -----
export const devLoginSchema = z.object({ email: z.string().email() });
export type DevLoginInput = z.infer<typeof devLoginSchema>;

export interface Me {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  workspaces: { id: string; name: string; role: Role }[];
  authProviders: { github: boolean; devLogin: boolean };
}

// ----- Workspaces -----
export const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(80) });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  status: string;
  role: Role;
}

// ----- Members & invitations -----
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
}

// ----- Services -----
const repoFullName = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo');

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  environment: z.string().trim().min(1).max(40),
  repositoryFullName: repoFullName.nullable().optional(),
  defaultBranch: z.string().trim().min(1).max(100).default('main'),
});
export type CreateServiceInput = z.input<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;

export interface Service {
  id: string;
  name: string;
  environment: string;
  repositoryFullName: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Audit -----
export const auditQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  outcome: z.enum(['success', 'denied', 'failure']).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'success' | 'denied' | 'failure';
  correlationId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}
