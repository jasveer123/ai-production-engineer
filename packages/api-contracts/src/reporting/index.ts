import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

const flag = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true')
  .default(false);

export const reportQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  monitorId: uuidSchema.optional(),
  policyId: uuidSchema.optional(),
  acknowledgedBy: uuidSchema.optional(),
  resolvedBy: uuidSchema.optional(),
  businessHours: flag,
  weekdays: flag,
  timezone: z.string().max(64).default('UTC'),
});
export type ReportQuery = z.output<typeof reportQuerySchema>;
export type ReportQueryInput = z.input<typeof reportQuerySchema>;

export interface ReportIncidentRow {
  id: Uuid;
  title: string;
  severity: string;
  monitorName: string | null;
  startedAt: IsoTimestamp;
  acknowledgedAt: IsoTimestamp | null;
  acknowledgedBy: string | null;
  resolvedAt: IsoTimestamp | null;
  resolvedBy: string | null;
  resolutionOrigin: string | null;
}

export interface IncidentsOverview {
  started: number;
  resolved: number;
  acknowledged: number;
  acknowledgedShare: number | null;
  mttaSeconds: number | null;
  mttrSeconds: number | null;
  unacknowledged: number;
  unresolved: number;
  missingTimestamps: number;
  heatmap: number[][];
  daily: { day: string; started: number; resolved: number }[];
  incidents: ReportIncidentRow[];
  truncated: boolean;
}

export interface MonitorReportRow {
  monitorId: Uuid;
  name: string;
  checks: number;
  failedChecks: number;
  availability: number | null;
  downtimeSeconds: number;
  incidents: number;
  mttaSeconds: number | null;
  mttrSeconds: number | null;
}

export interface ResponderReportRow {
  userId: Uuid;
  name: string | null;
  email: string;
  acknowledged: number;
  resolved: number;
  timeSpentSeconds: number;
}

export interface NotificationVolumeRow {
  channel: string;
  status: string;
  count: number;
}
