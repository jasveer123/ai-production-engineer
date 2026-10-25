import { z } from 'zod';

export const INCIDENT_STATUSES = [
  'detected',
  'investigating',
  'fix_proposed',
  'validation',
  'awaiting_review',
  'monitoring',
  'resolved',
  'needs_attention',
  'closed_without_fix',
  'validation_failed',
  'verification_inconclusive',
] as const;
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const severitySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof severitySchema>;

/** Closed incidents. A recurrence of the same fingerprint opens a new incident. */
export const CLOSED_STATUSES: readonly IncidentStatus[] = ['resolved', 'closed_without_fix'];

/** The incident state machine (FRD FR-05). The API rejects any transition not listed here. */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  detected: ['investigating', 'needs_attention', 'closed_without_fix'],
  investigating: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  fix_proposed: ['validation', 'needs_attention', 'closed_without_fix'],
  validation: ['awaiting_review', 'validation_failed'],
  validation_failed: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  awaiting_review: ['monitoring', 'fix_proposed', 'closed_without_fix'],
  monitoring: ['resolved', 'needs_attention', 'verification_inconclusive'],
  verification_inconclusive: ['monitoring', 'resolved', 'needs_attention'],
  needs_attention: ['investigating', 'resolved', 'closed_without_fix'],
  resolved: ['needs_attention'],
  closed_without_fix: ['needs_attention'],
};

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: Severity;
  source: string;
  serviceId: string | null;
  serviceName: string | null;
  environment: string | null;
  /** The mapped service's repository, or null when the telemetry service is not mapped yet. */
  repositoryFullName: string | null;
  fingerprint: string;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  version: number;
  createdAt: string;
}

export const incidentListQuerySchema = z.object({
  status: z.union([incidentStatusSchema, z.literal('open'), z.literal('closed')]).optional(),
  severity: severitySchema.optional(),
  serviceId: z.string().uuid().optional(),
  environment: z.string().max(40).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type IncidentListQuery = z.input<typeof incidentListQuerySchema>;

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  severity: severitySchema.default('medium'),
  serviceId: z.string().uuid().optional(),
});
export type CreateIncidentInput = z.input<typeof createIncidentSchema>;

export const transitionIncidentSchema = z.object({
  to: incidentStatusSchema,
  reason: z.string().trim().max(1000).optional(),
  /** Optimistic concurrency: the incident version the user was looking at. */
  expectedVersion: z.number().int().positive(),
});
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>;

export type TimelineEntry =
  | {
      kind:
        'error' | 'created' | 'status_change' | 'investigation' | 'fix' | 'verification' | 'alert';
      id: string;
      at: string;
      source: string;
      summary: string | null;
      traceId: string | null;
      sourceUrl: string | null;
      actorEmail: string | null;
      attributes: Record<string, unknown>;
    }
  | {
      kind: 'deploy';
      id: string;
      at: string;
      source: string;
      summary: string;
      commitSha: string;
      version: string | null;
      environment: string;
    };
