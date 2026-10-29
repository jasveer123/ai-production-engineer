import { z } from 'zod';
import { nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';
import { severitySchema, type Severity } from '../incidents/status';

export const ALERT_CONDITION_OPS = [
  'eq',
  'neq',
  'contains',
  'not_contains',
  'regex',
  'exists',
  'not_exists',
] as const;

const VALUELESS_OPS: readonly string[] = ['exists', 'not_exists'];

const isValidRegex = (pattern: string) => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

export const alertConditionSchema = z
  .object({
    field: z
      .string()
      .regex(
        /^(title|description|severity|status|label\.[A-Za-z0-9_.\-/]{1,100})$/,
        'Use title, description, severity, status or label.<name>',
      ),
    op: z.enum(ALERT_CONDITION_OPS),
    value: z.string().max(200).optional(),
  })
  .refine((c) => VALUELESS_OPS.includes(c.op) || c.value !== undefined, {
    message: 'This operator needs a value',
  })
  .refine((c) => c.op !== 'regex' || isValidRegex(c.value ?? ''), {
    message: 'Not a valid regular expression',
  });
export type AlertCondition = z.infer<typeof alertConditionSchema>;

export const alertRouteSchema = z.object({
  name: nameSchema(80),
  enabled: z.boolean().default(true),
  sourceIds: z.array(uuidSchema).max(50).default([]),
  conditions: z.array(alertConditionSchema).max(20).default([]),
  groupBy: z.array(nameSchema(100)).max(5).default([]),
  createIncident: z.boolean().default(true),
  incidentSeverity: severitySchema.nullable().default(null),
});
export type AlertRouteInput = z.input<typeof alertRouteSchema>;

export const updateAlertRouteSchema = alertRouteSchema.partial();
export const reorderAlertRoutesSchema = z.object({ ids: z.array(uuidSchema).max(200) });

export interface AlertRoute {
  id: Uuid;
  name: string;
  position: number;
  enabled: boolean;
  sourceIds: Uuid[];
  conditions: AlertCondition[];
  groupBy: string[];
  createIncident: boolean;
  incidentSeverity: Severity | null;
  createdAt: IsoTimestamp;
}
