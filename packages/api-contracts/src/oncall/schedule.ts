import { z } from 'zod';
import { isoDateTimeSchema, nameSchema, uuidSchema, type IsoTimestamp, type Uuid } from '../common';

export const MAX_ROTATION_HOURS = 24 * 30;
export const MAX_PARTICIPANTS = 30;
export const MAX_OVERRIDE_DAYS = 60;

export const createScheduleSchema = z.object({
  name: nameSchema(80),
  rotationHours: z.number().int().min(1).max(MAX_ROTATION_HOURS).default(168),
  anchorAt: isoDateTimeSchema.optional(),
  participantIds: z.array(uuidSchema).min(1).max(MAX_PARTICIPANTS),
});
export type CreateScheduleInput = z.input<typeof createScheduleSchema>;

export const updateScheduleSchema = createScheduleSchema.partial();
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

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

export interface ScheduleView {
  id: Uuid;
  name: string;
  rotationHours: number;
  anchorAt: IsoTimestamp;
  participants: OncallPerson[];
  current: OncallShift | null;
  upcoming: OncallShift[];
  overrides: OverrideView[];
  createdAt: IsoTimestamp;
}

export interface OncallNow {
  scheduleId: Uuid;
  scheduleName: string;
  shift: OncallShift | null;
}
