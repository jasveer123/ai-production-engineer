import { z } from "zod"

export const personSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
})
export type Person = z.infer<typeof personSchema>

export const shiftSchema = z.object({
  person: personSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  override: z.boolean(),
})
export type Shift = z.infer<typeof shiftSchema>

export const overrideSchema = z.object({
  id: z.string(),
  person: personSchema,
  startsAt: z.string(),
  endsAt: z.string(),
})
export type Override = z.infer<typeof overrideSchema>

export const scheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  rotationHours: z.number(),
  anchorAt: z.string(),
  participants: z.array(personSchema),
  current: shiftSchema.nullable(),
  upcoming: z.array(shiftSchema),
  overrides: z.array(overrideSchema),
  createdAt: z.string(),
})
export type Schedule = z.infer<typeof scheduleSchema>

export const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.string(),
})
export type Member = z.infer<typeof memberSchema>

export interface ScheduleRequest {
  name: string
  rotationHours: number
  anchorAt: string
  participantIds: string[]
}

export interface OverrideRequest {
  userId: string
  startsAt: string
  endsAt: string
}
