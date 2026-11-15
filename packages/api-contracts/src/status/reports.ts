import { z } from 'zod';
import { isoDateTimeSchema, nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const UPDATE_STATES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type UpdateState = (typeof UPDATE_STATES)[number];
export const IMPACTS = ['degraded', 'downtime', 'resolved'] as const;
export type Impact = (typeof IMPACTS)[number];

const affectedSchema = z
  .array(z.object({ resourceId: uuidSchema, impact: z.enum(IMPACTS) }))
  .max(30)
  .default([]);

export const createReportSchema = z.object({
  title: nameSchema(120),
  body: z.string().trim().max(2000).default(''),
  state: z.enum(UPDATE_STATES).default('investigating'),
  affected: affectedSchema,
  publishedAt: isoDateTimeSchema.optional(),
  notifySubscribers: z.boolean().default(true),
});
export type CreateReportInput = z.input<typeof createReportSchema>;

export const editReportSchema = z.object({
  title: nameSchema(120).optional(),
  affected: affectedSchema.optional(),
  publishedAt: isoDateTimeSchema.optional(),
});
export type EditReportInput = z.input<typeof editReportSchema>;

export const reportUpdateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  state: z.enum(UPDATE_STATES),
  affected: affectedSchema.optional(),
  notifySubscribers: z.boolean().default(true),
});
export type ReportUpdateInput = z.input<typeof reportUpdateSchema>;

export const editUpdateSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export type EditUpdateInput = z.infer<typeof editUpdateSchema>;

export const postUpdateSchema = z.object({
  title: nameSchema(120),
  body: z.string().trim().max(2000).default(''),
  state: z.enum(UPDATE_STATES),
});
export type PostUpdateInput = z.input<typeof postUpdateSchema>;

export const maintenanceSchema = z
  .object({
    title: nameSchema(120),
    description: z.string().trim().max(2000).default(''),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    timezone: z.string().trim().min(1).max(64).default('UTC'),
    resourceIds: z.array(uuidSchema).max(30).default([]),
    notifySubscribers: z.boolean().default(true),
  })
  .refine((m) => new Date(m.endsAt) > new Date(m.startsAt), {
    message: 'The end must be after the start',
    path: ['endsAt'],
  })
  .refine((m) => Intl.supportedValuesOf('timeZone').concat('UTC').includes(m.timezone), {
    message: 'Unknown time zone',
    path: ['timezone'],
  });
export type MaintenanceInput = z.input<typeof maintenanceSchema>;

export interface ReportUpdateView {
  id: Uuid;
  body: string;
  state: UpdateState;
  createdAt: IsoTimestamp;
}

export interface AffectedView {
  resourceId: Uuid;
  name: string;
  impact: Impact;
}

export interface ReportView {
  id: Uuid;
  title: string;
  state: UpdateState;
  auto: boolean;
  affected: AffectedView[];
  updates: ReportUpdateView[];
  publishedAt: IsoTimestamp;
  resolvedAt: IsoTimestamp | null;
}

export type MaintenancePhase = 'upcoming' | 'in_progress' | 'completed';

export interface MaintenanceView {
  id: Uuid;
  title: string;
  description: string;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  timezone: string;
  phase: MaintenancePhase;
  affected: { resourceId: Uuid; name: string }[];
}

export interface CreatedReport {
  id: Uuid;
  fanout: 'queued' | 'skipped';
}
