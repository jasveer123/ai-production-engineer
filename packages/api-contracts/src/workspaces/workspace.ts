import { z } from 'zod';
import { nameSchema, type Role, type Uuid } from '../common';

export const createWorkspaceSchema = z.object({ name: nameSchema(80).min(2) });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export interface Workspace {
  id: Uuid;
  name: string;
  plan: string;
  status: string;
  role: Role;
}
