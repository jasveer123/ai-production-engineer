import { z } from 'zod';
import { isoDateTimeSchema, nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const MAX_ROTATION_HOURS = 24 * 30;
export const MAX_PARTICIPANTS = 30;
export const MAX_OVERRIDE_DAYS = 60;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().regex(HHMM, 'Use HH:MM');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const isIanaTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
export const timeZoneSchema = z.string().min(1).max(64).refine(isIanaTimeZone, 'Unknown time zone');

export const rotationRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('calendar'),
    lengthDays: z.number().int().min(1).max(90),
    startDate: dateSchema,
    handoffTime: timeSchema,
  }),
  z.object({
    kind: z.literal('elapsed'),
    hours: z.number().int().min(1).max(MAX_ROTATION_HOURS),
    anchorAt: isoDateTimeSchema,
  }),
]);
export type RotationRule = z.infer<typeof rotationRuleSchema>;

export const restrictionSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start: timeSchema,
  end: timeSchema,
});
export type LayerRestriction = z.infer<typeof restrictionSchema>;

export const layerSchema = z.object({
  id: z.string().min(1).max(40),
  name: nameSchema(80),
  rotation: rotationRuleSchema,
  participantIds: z.array(uuidSchema).min(1).max(MAX_PARTICIPANTS),
  restrictions: z.array(restrictionSchema).max(14).default([]),
});
export type LayerInput = z.input<typeof layerSchema>;

export const createScheduleSchema = z
  .object({
    name: nameSchema(80),
    timezone: timeZoneSchema.default('UTC'),
    layers: z.array(layerSchema).max(10).optional(),
    rotationHours: z.number().int().min(1).max(MAX_ROTATION_HOURS).default(168),
    anchorAt: isoDateTimeSchema.optional(),
    participantIds: z.array(uuidSchema).max(MAX_PARTICIPANTS).default([]),
  })
  .refine((s) => (s.layers?.length ?? 0) > 0 || s.participantIds.length > 0, {
    message: 'Add at least one layer with people on it',
    path: ['layers'],
  });
export type CreateScheduleInput = z.input<typeof createScheduleSchema>;

export const updateScheduleSchema = z.object({
  name: nameSchema(80).optional(),
  timezone: timeZoneSchema.optional(),
  layers: z.array(layerSchema).min(1).max(10).optional(),
  rotationHours: z.number().int().min(1).max(MAX_ROTATION_HOURS).optional(),
  anchorAt: isoDateTimeSchema.optional(),
  participantIds: z.array(uuidSchema).min(1).max(MAX_PARTICIPANTS).optional(),
});
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const coverageQuerySchema = z
  .object({ from: isoDateTimeSchema, to: isoDateTimeSchema })
  .refine((q) => new Date(q.to) > new Date(q.from), { message: 'to must be after from' })
  .refine((q) => new Date(q.to).getTime() - new Date(q.from).getTime() <= 92 * 86_400_000, {
    message: 'At most 92 days at a time',
  });
export type CoverageQuery = z.infer<typeof coverageQuerySchema>;

export const createOverrideSchema = z
  .object({
    userId: uuidSchema,
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
  })
  .refine((o) => new Date(o.endsAt) > new Date(o.startsAt), {
    message: 'The override must end after it starts',
    path: ['endsAt'],
  });
export type CreateOverrideInput = z.infer<typeof createOverrideSchema>;

export interface OncallPerson {
  userId: Uuid;
  name: string | null;
  email: string;
}

export interface OncallShift {
  person: OncallPerson;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  override: boolean;
}

export interface OverrideView {
  id: Uuid;
  person: OncallPerson;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
}

export interface LayerView {
  id: string;
  name: string;
  rotation: RotationRule;
  participants: OncallPerson[];
  restrictions: LayerRestriction[];
}

export interface CoverageInterval {
  person: OncallPerson;
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
  source: 'layer' | 'override';
  layerId: string | null;
  layerName: string | null;
}

export interface CoverageGap {
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
}

export interface ScheduleCoverage {
  scheduleId: Uuid;
  timezone: string;
  from: IsoTimestamp;
  to: IsoTimestamp;
  intervals: CoverageInterval[];
  gaps: CoverageGap[];
}

export interface ScheduleView {
  id: Uuid;
  name: string;
  timezone: string;
  rotationHours: number;
  anchorAt: IsoTimestamp;
  layers: LayerView[];
  participants: OncallPerson[];
  current: OncallShift | null;
  upcoming: OncallShift[];
  gaps: CoverageGap[];
  overrides: OverrideView[];
  calendarEnabled: boolean;
  createdAt: IsoTimestamp;
}

export interface CalendarLink {
  url: string;
}

export interface OncallNow {
  scheduleId: Uuid;
  scheduleName: string;
  shift: OncallShift | null;
}
