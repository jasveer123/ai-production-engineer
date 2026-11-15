import { z } from "zod"

export const assigneeSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
})

export const errorGroupSchema = z.object({
  assignee: assigneeSchema.nullable(),
  id: z.string(),
  title: z.string(),
  errorType: z.string(),
  message: z.string(),
  service: z.string(),
  environment: z.string(),
  status: z.string(),
  count: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  release: z.string().nullable(),
  incidentId: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  applicationId: z.string().nullable().default(null),
  usersAffected: z.number().default(0),
  snoozeUntil: z.string().nullable().default(null),
  snoozeRemaining: z.number().nullable().default(null),
})
export type ErrorGroup = z.infer<typeof errorGroupSchema>

export const frameSchema = z.object({
  function: z.string().nullable(),
  file: z.string().nullable(),
  line: z.number().nullable(),
  column: z.number().nullable(),
  inApp: z.boolean(),
  context: z
    .object({ pre: z.array(z.string()), line: z.string(), post: z.array(z.string()) })
    .nullable(),
  mapped: z.boolean(),
})
export type ErrorFrame = z.infer<typeof frameSchema>

export const exceptionSchema = z.object({
  type: z.string(),
  value: z.string(),
  frames: z.array(frameSchema),
})
export type ErrorException = z.infer<typeof exceptionSchema>

export const breadcrumbSchema = z.object({
  ts: z.number().nullable(),
  category: z.string().nullable(),
  level: z.string().nullable(),
  message: z.string().nullable(),
  type: z.string().nullable(),
})
export type ErrorBreadcrumb = z.infer<typeof breadcrumbSchema>

export const errorDetailSchema = errorGroupSchema.extend({
  stack: z.array(z.string()),
  symbolicated: z.array(z.string()).nullable(),
  route: z.string().nullable(),
  occurrences: z.array(
    z.object({
      id: z.number(),
      occurredAt: z.string(),
      traceId: z.string().nullable(),
      release: z.string().nullable(),
      message: z.string(),
    })
  ),
  hourly: z.array(z.object({ at: z.string(), count: z.number() })),
  latest: z
    .object({
      eventId: z.string().nullable(),
      occurredAt: z.string(),
      level: z.string().nullable(),
      platform: z.string().nullable(),
      exceptions: z.array(exceptionSchema),
      breadcrumbs: z.array(breadcrumbSchema),
      user: z.record(z.string(), z.string()).nullable(),
      tags: z.record(z.string(), z.string()),
      contexts: z.record(z.string(), z.unknown()),
      request: z.object({ url: z.string().nullable(), method: z.string().nullable() }).nullable(),
    })
    .nullable()
    .default(null),
  rumSessionId: z.string().nullable().default(null),
  byRelease: z.array(z.object({ release: z.string(), count: z.number() })).default([]),
  byEnvironment: z.array(z.object({ environment: z.string(), count: z.number() })).default([]),
  tagFacets: z
    .array(
      z.object({
        key: z.string(),
        values: z.array(z.object({ value: z.string(), count: z.number() })),
      })
    )
    .default([]),
})
export type ErrorDetail = z.infer<typeof errorDetailSchema>

export const releaseSchema = z.object({
  release: z.string(),
  events: z.number(),
  errors: z.number(),
  newErrors: z.number(),
  firstAt: z.string(),
  lastAt: z.string(),
})
export type ErrorRelease = z.infer<typeof releaseSchema>

export const sourceMapSchema = z.object({
  id: z.string(),
  release: z.string(),
  file: z.string(),
  sizeBytes: z.number(),
  createdAt: z.string(),
})
export type SourceMap = z.infer<typeof sourceMapSchema>

export const errorAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  publicKey: z.string(),
  projectId: z.number(),
  dsn: z.string(),
  rateLimitPerMinute: z.number(),
  droppedEvents: z.number(),
  lastEventAt: z.string().nullable(),
  createdAt: z.string(),
})
export type ErrorApp = z.infer<typeof errorAppSchema>

export interface ErrorFilters {
  status: string
  q: string
  assignee: string
  applicationId: string
  environment: string
  release: string
}
