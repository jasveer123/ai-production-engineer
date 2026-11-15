import { z } from "zod"

export const logLineSchema = z.object({
  id: z.number(),
  ts: z.string(),
  service: z.string(),
  environment: z.string(),
  level: z.string(),
  message: z.string(),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  traceId: z.string().nullable().optional(),
  spanId: z.string().nullable().optional(),
  host: z.string().nullable(),
  way: z.string(),
})
export type LogLine = z.infer<typeof logLineSchema>
