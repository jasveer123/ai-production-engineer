import { z } from 'zod';
import { Incident } from './incidents';

export const deploymentListQuerySchema = z.object({
  /** Telemetry service name, as the deploy marker reported it. */
  service: z.string().trim().min(1).max(100).optional(),
  environment: z.string().trim().min(1).max(40).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type DeploymentListQuery = z.input<typeof deploymentListQuerySchema>;

/** One deploy marker received by a deploy webhook, newest first. */
export interface Deployment {
  id: string;
  serviceId: string | null;
  serviceName: string;
  environment: string;
  commitSha: string;
  version: string | null;
  deployedAt: string;
  /** Name of the deploy webhook that sent it, or null if that webhook was deleted. */
  integrationName: string | null;
}

/** One deploy, its neighbours for the same service and environment, and what opened after it. */
export interface DeploymentDetail extends Deployment {
  previous: Deployment | null;
  next: Deployment | null;
  /** Incidents of this service and environment first seen after this deploy, before the next. */
  incidents: Pick<Incident, 'id' | 'title' | 'severity' | 'status' | 'firstSeenAt'>[];
  repositoryFullName: string | null;
}
