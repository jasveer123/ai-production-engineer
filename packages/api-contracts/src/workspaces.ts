import { z } from 'zod';
import { Role } from './common';

export const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(80) });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  status: string;
  role: Role;
}
