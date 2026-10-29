import { z } from 'zod';
import {
  nameSchema,
  optionalText,
  pagedQuery,
  uuidSchema,
  type Attributes,
  type IsoTimestamp,
  type Uuid,
} from '../common';
import { incidentStatusSchema, severitySchema, type IncidentStatus, type Severity } from './status';

export interface Incident {
  id: Uuid;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: Severity;
  source: string;
  serviceId: Uuid | null;
  serviceName: string | null;
  environment: string | null;
  repositoryFullName: string | null;
  fingerprint: string;
  eventCount: number;
  firstSeenAt: IsoTimestamp;
  lastSeenAt: IsoTimestamp;
  version: number;
  createdAt: IsoTimestamp;
}

export const incidentListQuerySchema = pagedQuery(100, 50).extend({
  status: z.union([incidentStatusSchema, z.literal('open'), z.literal('closed')]).optional(),
  severity: severitySchema.optional(),
  serviceId: uuidSchema.optional(),
  environment: z.string().max(40).optional(),
});
export type IncidentListQuery = z.input<typeof incidentListQuerySchema>;

export const createIncidentSchema = z.object({
  title: nameSchema(200).min(3),
  description: optionalText(5000),
  severity: severitySchema.default('medium'),
  serviceId: uuidSchema.optional(),
});
export type CreateIncidentInput = z.input<typeof createIncidentSchema>;

export const transitionIncidentSchema = z.object({
  to: incidentStatusSchema,
  reason: optionalText(1000),
  expectedVersion: z.number().int().positive(),
});
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>;

interface TimelineBase {
  id: Uuid;
  at: IsoTimestamp;
  source: string;
}

export type TimelineEntry =
  | (TimelineBase & {
      kind:
        'error' | 'created' | 'status_change' | 'investigation' | 'fix' | 'verification' | 'alert';
      summary: string | null;
      traceId: string | null;
      sourceUrl: string | null;
      actorEmail: string | null;
      attributes: Attributes;
    })
  | (TimelineBase & {
      kind: 'deploy';
      summary: string;
      commitSha: string;
      version: string | null;
      environment: string;
    });
