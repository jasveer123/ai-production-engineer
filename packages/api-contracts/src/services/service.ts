import { z } from 'zod';
import { nameSchema, repoFullNameSchema, type IsoTimestamp, type Uuid } from '../common';

export const createServiceSchema = z.object({
  name: nameSchema(100),
  environment: nameSchema(40),
  repositoryFullName: repoFullNameSchema.nullable().optional(),
  defaultBranch: nameSchema(100).default('main'),
});
export type CreateServiceInput = z.input<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;

export interface DiscoveredService {
  name: string;
  environment: string;
  lastReceivedAt: IsoTimestamp;
}

export interface Service {
  id: Uuid;
  name: string;
  environment: string;
  repositoryFullName: string | null;
  defaultBranch: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}
