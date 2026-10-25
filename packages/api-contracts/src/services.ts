import { z } from 'zod';

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

/** A service name seen in this workspace's telemetry that has no service mapping yet (FR-03). */
export interface DiscoveredService {
  name: string;
  environment: string;
  lastReceivedAt: string;
}

export interface Service {
  id: string;
  name: string;
  environment: string;
  repositoryFullName: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}
