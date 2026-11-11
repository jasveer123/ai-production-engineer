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
})
export type ErrorGroup = z.infer<typeof errorGroupSchema>

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
