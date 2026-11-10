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

export const histogramBucketSchema = z.object({
  at: z.string(),
  total: z.number(),
  errors: z.number(),
})

export const logSearchSchema = z.object({
  lines: z.array(logLineSchema),
  histogram: z.array(histogramBucketSchema),
  nextBefore: z.number().nullable().optional(),
  services: z.array(z.string()),
})
export type LogSearch = z.infer<typeof logSearchSchema>

export interface LogFilters {
  text: string
  levels: string[]
  services: string[]
}

export const EMPTY_FILTERS: LogFilters = { text: "", levels: [], services: [] }
