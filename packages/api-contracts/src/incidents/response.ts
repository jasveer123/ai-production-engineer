import { z } from 'zod';
import { nameSchema, optionalText, uuidSchema } from '../common';
import type { Attributes, IsoTimestamp, Uuid } from '../common';
import { severitySchema } from './status';

export const RESPONSE_STATES = ['open', 'acknowledged', 'resolved'] as const;
export const responseStateSchema = z.enum(RESPONSE_STATES);
export type ResponseState = z.infer<typeof responseStateSchema>;

export const RESOLUTION_ORIGINS = ['manual', 'automatic'] as const;
export type ResolutionOrigin = (typeof RESOLUTION_ORIGINS)[number];

export interface PersonRef {
  id: Uuid;
  name: string | null;
  email: string;
}

const expectedVersion = z.number().int().positive().optional();

export const responseActionSchema = z.object({
  expectedVersion,
  reason: optionalText(1000),
});
export type ResponseActionInput = z.infer<typeof responseActionSchema>;

export const updateIncidentSchema = z
  .object({
    title: nameSchema(200).min(3).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    severity: severitySchema.optional(),
    assigneeId: uuidSchema.nullable().optional(),
    expectedVersion,
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), 'Nothing to update');
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const escalateIncidentSchema = z.object({ policyId: uuidSchema.optional() });
export type EscalateIncidentInput = z.infer<typeof escalateIncidentSchema>;

export const commentSchema = z.object({ body: nameSchema(5000) });
export type CommentInput = z.infer<typeof commentSchema>;

export const postMortemSchema = z.object({ body: z.string().max(100_000) });
export type PostMortemInput = z.infer<typeof postMortemSchema>;

export const incidentMetadataSchema = z.object({
  metadata: z
    .record(z.string().trim().min(1).max(100), z.string().max(1000))
    .refine((m) => Object.keys(m).length <= 50, 'At most 50 entries'),
});
export type IncidentMetadataInput = z.infer<typeof incidentMetadataSchema>;

export const activityQuerySchema = z.object({
  after: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ActivityQuery = z.input<typeof activityQuerySchema>;

export const ACTIVITY_KINDS = [
  'incident_started',
  'check_failed',
  'alert',
  'error',
  'deploy',
  'notification',
  'acknowledged',
  'unacknowledged',
  'escalated',
  'comment',
  'status_change',
  'ai',
  'updated',
  'resolved',
  'reopened',
  'post_mortem',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: IsoTimestamp;
  summary: string;
  source: string;
  actor: PersonRef | null;
  editable: boolean;
  body: string | null;
  region: string | null;
  statusCode: number | null;
  channel: string | null;
  address: string | null;
  deliveryStatus: string | null;
  sourceUrl: string | null;
  attributes: Attributes;
}

export interface ActivityPage {
  entries: ActivityEntry[];
  nextCursor: string | null;
}

export interface CapturedResponse {
  checkedAt: IsoTimestamp;
  statusCode: number | null;
  error: string | null;
  region: string | null;
  headers: Record<string, string> | null;
  bodyPreview: string | null;
}

export interface IncidentEscalationView {
  policyId: Uuid | null;
  policyName: string;
  state: string;
  stepIndex: number;
  nextRunAt: IsoTimestamp | null;
}

export interface IncidentContext {
  monitor: {
    id: Uuid;
    name: string;
    kind: string;
    url: string | null;
    method: string;
  } | null;
  replayCommand: string | null;
  lastResponse: CapturedResponse | null;
  escalations: IncidentEscalationView[];
  inheritedMetadata: Record<string, string>;
}

export const reportIncidentNotifySchema = z.enum(['none', 'policy', 'team']);
