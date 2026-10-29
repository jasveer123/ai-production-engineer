import { z } from 'zod';
import {
  pagedQuery,
  uuidSchema,
  type Attributes,
  type IsoTimestamp,
  type Uuid,
  type ValueOf,
} from '../common';

export const AUDIT_OUTCOMES = ['success', 'denied', 'failure'] as const;
export type AuditOutcome = ValueOf<typeof AUDIT_OUTCOMES>;

export const auditQuerySchema = pagedQuery(200, 50).extend({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: uuidSchema.optional(),
  outcome: z.enum(AUDIT_OUTCOMES).optional(),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export interface AuditEvent {
  id: Uuid;
  actorId: Uuid | null;
  actorEmail: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  correlationId: string;
  metadata: Attributes;
  occurredAt: IsoTimestamp;
}
