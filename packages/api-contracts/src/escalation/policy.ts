import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';
import { severitySchema, type Severity } from '../incidents/status';

export const MAX_STEPS = 10;
export const MAX_TARGETS = 10;
export const MAX_WAIT_MINUTES = 24 * 60;

export const escalationTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schedule'), scheduleId: uuidSchema }),
  z.object({ kind: z.literal('user'), userId: uuidSchema }),
  z.object({ kind: z.literal('everyone') }),
]);
export type EscalationTarget = z.infer<typeof escalationTargetSchema>;

export const escalationStepSchema = z.object({
  waitMinutes: z.number().int().min(0).max(MAX_WAIT_MINUTES).default(0),
  targets: z.array(escalationTargetSchema).min(1).max(MAX_TARGETS),
});
export type EscalationStep = z.infer<typeof escalationStepSchema>;

export const createPolicySchema = z.object({
  name: nameSchema(80),
  minSeverity: severitySchema.default('high'),
  enabled: z.boolean().default(true),
  steps: z.array(escalationStepSchema).min(1).max(MAX_STEPS),
});
export type CreatePolicyInput = z.input<typeof createPolicySchema>;

export const updatePolicySchema = createPolicySchema.partial();
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

export type TargetView = EscalationTarget & { label: string };

export interface PolicyStepView {
  waitMinutes: number;
  targets: TargetView[];
}

export interface PolicyView {
  id: Uuid;
  name: string;
  minSeverity: Severity;
  enabled: boolean;
  steps: PolicyStepView[];
  createdAt: IsoTimestamp;
}

export type EscalationRunState = 'running' | 'completed' | 'acknowledged' | 'cancelled';

export interface EscalationNotificationView {
  stepIndex: number;
  email: string;
  name: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  sentAt: IsoTimestamp;
}

export interface EscalationRunView {
  id: Uuid;
  incidentId: Uuid;
  incidentTitle: string;
  severity: Severity;
  policyId: Uuid;
  policyName: string;
  state: EscalationRunState;
  stepsDone: number;
  totalSteps: number;
  nextRunAt: IsoTimestamp | null;
  startedAt: IsoTimestamp;
  finishedAt: IsoTimestamp | null;
  notifications: EscalationNotificationView[];
}
