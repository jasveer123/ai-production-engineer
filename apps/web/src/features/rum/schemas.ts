import { z } from "zod"

export const appSchema = z.object({
  id: z.string(),
  name: z.string(),
  appKey: z.string(),
  sessions24h: z.number(),
  createdAt: z.string(),
})
export type RumApp = z.infer<typeof appSchema>

export const sessionSchema = z.object({
  id: z.string(),
  appId: z.string(),
  appName: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  startedAt: z.string(),
  lastSeenAt: z.string(),
  durationSeconds: z.number(),
  pageViews: z.number(),
  errors: z.number(),
  clicks: z.number(),
  entryUrl: z.string().nullable(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  device: z.string().nullable(),
  hasReplay: z.boolean(),
})
export type RumSession = z.infer<typeof sessionSchema>

export const eventSchema = z.object({
  id: z.number(),
  ts: z.string(),
  type: z.string(),
  name: z.string(),
  url: z.string().nullable(),
  value: z.number().nullable(),
  props: z.record(z.string(), z.unknown()),
})
export type RumEvent = z.infer<typeof eventSchema>

export const sessionDetailSchema = sessionSchema.extend({ events: z.array(eventSchema) })
export type RumSessionDetail = z.infer<typeof sessionDetailSchema>

export const replaySchema = z.object({
  viewport: z.object({ w: z.number(), h: z.number() }).nullable(),
  startedAt: z.string(),
  snapshots: z.array(z.object({ ts: z.number(), html: z.string(), url: z.string().nullable() })),
  moves: z.array(
    z.object({ ts: z.number(), t: z.enum(["m", "c", "s"]), x: z.number(), y: z.number() })
  ),
})
export type RumReplay = z.infer<typeof replaySchema>

export const overviewSchema = z.object({
  sessions: z.number(),
  users: z.number(),
  pageViews: z.number(),
  errors: z.number(),
  vitals: z.array(z.object({ name: z.string(), p75: z.number().nullable(), samples: z.number() })),
  trend: z.array(z.object({ at: z.string(), sessions: z.number(), errors: z.number() })),
  topPages: z.array(z.object({ url: z.string(), views: z.number() })),
})
export type RumOverview = z.infer<typeof overviewSchema>

export const userSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  sessions: z.number(),
  errors: z.number(),
  lastSeenAt: z.string(),
})
export type RumUser = z.infer<typeof userSchema>

export const eventSummarySchema = z.object({
  type: z.string(),
  name: z.string(),
  count: z.number(),
  sessions: z.number(),
})
export type RumEventSummary = z.infer<typeof eventSummarySchema>

export const stepSchema = z.object({
  kind: z.enum(["pageview", "event"]),
  match: z.string(),
  label: z.string().optional(),
})
export type FunnelStep = z.infer<typeof stepSchema>

export const funnelSchema = z.object({
  id: z.string(),
  appId: z.string(),
  name: z.string(),
  steps: z.array(stepSchema),
  createdAt: z.string(),
})
export type Funnel = z.infer<typeof funnelSchema>

export const funnelResultSchema = z.object({
  funnel: funnelSchema,
  steps: z.array(
    z.object({
      label: z.string(),
      sessions: z.number(),
      conversion: z.number(),
      dropOff: z.number(),
    })
  ),
})
export type FunnelResult = z.infer<typeof funnelResultSchema>
