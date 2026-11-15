import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';
import { LOG_LEVELS } from '../telemetry/logs';

export const LOG_ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type LogAlertState = 'ok' | 'firing';

export const createLogAlertSchema = z.object({
  name: nameSchema(80),
  levels: z.array(z.enum(LOG_LEVELS)).min(1).default(['error', 'fatal']),
  service: z.string().trim().min(1).max(120).optional(),
  contains: z.string().trim().min(1).max(200).optional(),
  threshold: z.number().int().min(1).max(100_000).default(10),
  windowMinutes: z.number().int().min(1).max(1440).default(5),
  severity: z.enum(LOG_ALERT_SEVERITIES).default('high'),
});
export type CreateLogAlertInput = z.input<typeof createLogAlertSchema>;

export const updateLogAlertSchema = createLogAlertSchema.partial().extend({
  paused: z.boolean().optional(),
  service: z.string().trim().min(1).max(120).nullable().optional(),
  contains: z.string().trim().min(1).max(200).nullable().optional(),
});
export type UpdateLogAlertInput = z.infer<typeof updateLogAlertSchema>;

export interface LogAlertView {
  id: Uuid;
  name: string;
  levels: string[];
  service: string | null;
  contains: string | null;
  threshold: number;
  windowMinutes: number;
  severity: string;
  paused: boolean;
  state: LogAlertState;
  stateSince: IsoTimestamp;
  lastCount: number | null;
  lastCheckedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}
