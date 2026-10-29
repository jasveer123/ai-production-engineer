import { z } from 'zod';
import { nameSchema, pagedQuery, type IsoTimestamp, type Uuid } from '../common';
import type { Incident } from '../incidents/incident';

export const deploymentListQuerySchema = pagedQuery(200, 50).extend({
  service: nameSchema(100).optional(),
  environment: nameSchema(40).optional(),
});
export type DeploymentListQuery = z.input<typeof deploymentListQuerySchema>;

export interface Deployment {
  id: Uuid;
  serviceId: Uuid | null;
  serviceName: string;
  environment: string;
  commitSha: string;
  version: string | null;
  deployedAt: IsoTimestamp;
  integrationName: string | null;
}

export interface DeploymentDetail extends Deployment {
  previous: Deployment | null;
  next: Deployment | null;
  incidents: Pick<Incident, 'id' | 'title' | 'severity' | 'status' | 'firstSeenAt'>[];
  repositoryFullName: string | null;
}
