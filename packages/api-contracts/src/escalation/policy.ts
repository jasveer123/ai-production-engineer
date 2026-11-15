import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';
import { severitySchema, type Severity } from '../incidents/status';
import type { DeliveryAttemptView } from '../integrations/notifications';

export const MAX_STEPS = 10;
export const MAX_TARGETS = 10;
export const MAX_WAIT_MINUTES = 24 * 60;
export const MAX_REPEATS = 5;
export const MAX_BRANCHES = 5;

export const PERSON_CHANNELS = ['email', 'sms', 'call', 'push'] as const;
export const personChannelSchema = z.enum(PERSON_CHANNELS);
export type PersonChannel = z.infer<typeof personChannelSchema>;

export const escalationTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('schedule'), scheduleId: uuidSchema }),
  z.object({ kind: z.literal('user'), userId: uuidSchema }),
  z.object({ kind: z.literal('everyone') }),
  z.object({ kind: z.literal('channel'), channelId: uuidSchema }),
]);
export type EscalationTarget = z.infer<typeof escalationTargetSchema>;

export const escalationStepSchema = z.object({
  waitMinutes: z.number().int().min(0).max(MAX_WAIT_MINUTES).default(0),
  targets: z.array(escalationTargetSchema).min(1).max(MAX_TARGETS),
  channels: z.array(personChannelSchema).min(1).max(PERSON_CHANNELS.length).default(['email']),
});
export type EscalationStep = z.infer<typeof escalationStepSchema>;

export const CONDITION_KEYS = ['service', 'environment', 'source'] as const;
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const branchConditionSchema = z.object({
  minSeverity: severitySchema.optional(),
  metadata: z
    .array(z.object({ key: z.enum(CONDITION_KEYS), value: nameSchema(200) }))
    .max(5)
    .optional(),
  timeWindow: z
    .object({
      days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      from: hhmm,
      to: hhmm,
      timezone: nameSchema(64),
    })
    .optional(),
});
export type BranchCondition = z.infer<typeof branchConditionSchema>;

export const escalationBranchSchema = z.object({
  name: nameSchema(80),
  when: branchConditionSchema,
  steps: z.array(escalationStepSchema).min(1).max(MAX_STEPS),
});
export type EscalationBranch = z.infer<typeof escalationBranchSchema>;

export const createPolicySchema = z.object({
  name: nameSchema(80),
  minSeverity: severitySchema.default('high'),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  repeatCount: z.number().int().min(0).max(MAX_REPEATS).default(0),
  steps: z.array(escalationStepSchema).min(1).max(MAX_STEPS),
  branches: z.array(escalationBranchSchema).max(MAX_BRANCHES).default([]),
});
export type CreatePolicyInput = z.input<typeof createPolicySchema>;

export const updatePolicySchema = createPolicySchema.partial();
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

export const SIMPLE_ESCALATE_AFTER = [0, 3, 5, 10] as const;

export const simplePolicySchema = z.object({
  primary: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('schedule'), scheduleId: uuidSchema }),
    z.object({ kind: z.literal('user'), userId: uuidSchema }),
  ]),
  channels: z.array(personChannelSchema).min(1).max(PERSON_CHANNELS.length),
  escalateAfterMinutes: z
    .number()
    .int()
    .refine((n) => (SIMPLE_ESCALATE_AFTER as readonly number[]).includes(n))
    .nullable(),
  policyId: uuidSchema.optional(),
});
export type SimplePolicyInput = z.infer<typeof simplePolicySchema>;

export type TargetView = EscalationTarget & { label: string };

export interface PolicyStepView {
  waitMinutes: number;
  targets: TargetView[];
  channels: PersonChannel[];
}

export interface PolicyBranchView {
  name: string;
  when: BranchCondition;
  steps: PolicyStepView[];
}

export interface PolicyView {
  id: Uuid;
  name: string;
  minSeverity: Severity;
  enabled: boolean;
  isDefault: boolean;
  generated: boolean;
  repeatCount: number;
  steps: PolicyStepView[];
  branches: PolicyBranchView[];
  createdAt: IsoTimestamp;
}

export interface PreviewRecipient {
  name: string;
  channel: string;
  address: string;
  problem: string | null;
}

export interface PolicyPreview {
  branch: string | null;
  steps: { waitMinutes: number; recipients: PreviewRecipient[] }[];
}

export type EscalationRunState = 'running' | 'completed' | 'acknowledged' | 'cancelled' | 'skipped';
export type PolicySource = 'integration' | 'default' | 'builtin' | 'legacy';

export interface EscalationRunView {
  id: Uuid;
  incidentId: Uuid;
  incidentTitle: string;
  severity: Severity;
  policyId: Uuid | null;
  policyName: string;
  policySource: PolicySource;
  branch: string | null;
  state: EscalationRunState;
  stepsDone: number;
  totalSteps: number;
  repeatsDone: number;
  repeatCount: number;
  nextRunAt: IsoTimestamp | null;
  startedAt: IsoTimestamp;
  finishedAt: IsoTimestamp | null;
  deliveries: DeliveryAttemptView[];
}
