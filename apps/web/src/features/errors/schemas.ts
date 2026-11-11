import { z } from "zod"

export const errorGroupSchema = z.object({
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
