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

export const rotationSchema = z.union([
  z.object({
    kind: z.literal("calendar"),
    lengthDays: z.number(),
    startDate: z.string(),
    handoffTime: z.string(),
  }),
  z.object({ kind: z.literal("elapsed"), hours: z.number(), anchorAt: z.string() }),
])
export type Rotation = z.infer<typeof rotationSchema>

export const restrictionSchema = z.object({
  days: z.array(z.number()),
  start: z.string(),
  end: z.string(),
})
export type Restriction = z.infer<typeof restrictionSchema>

export const layerSchema = z.object({
  id: z.string(),
  name: z.string(),
  rotation: rotationSchema,
  participants: z.array(personSchema),
  restrictions: z.array(restrictionSchema),
})
export type Layer = z.infer<typeof layerSchema>

export const gapSchema = z.object({ startsAt: z.string(), endsAt: z.string() })
export type Gap = z.infer<typeof gapSchema>

export const coverageSchema = z.object({
  scheduleId: z.string(),
  timezone: z.string(),
  from: z.string(),
  to: z.string(),
  intervals: z.array(
    shiftSchema.omit({ override: true }).extend({
      source: z.string(),
      layerId: z.string().nullable(),
      layerName: z.string().nullable(),
    })
  ),
  gaps: z.array(gapSchema),
})
export type Coverage = z.infer<typeof coverageSchema>

export const scheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string().default("UTC"),
  layers: z.array(layerSchema).default([]),
  gaps: z.array(gapSchema).default([]),
  calendarEnabled: z.boolean().default(false),
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

export interface LayerRequest {
  id: string
  name: string
  rotation: Rotation
  participantIds: string[]
  restrictions: Restriction[]
}

export interface ScheduleRequest {
  name: string
  timezone: string
  layers: LayerRequest[]
}

export interface OverrideRequest {
  userId: string
  startsAt: string
  endsAt: string
}
