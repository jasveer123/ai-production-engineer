import { z } from "zod"

const reportIncidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  monitorName: z.string().nullable(),
  startedAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  resolutionOrigin: z.string().nullable(),
})

export const overviewSchema = z.object({
  started: z.number(),
  resolved: z.number(),
  acknowledged: z.number(),
  acknowledgedShare: z.number().nullable(),
  mttaSeconds: z.number().nullable(),
  mttrSeconds: z.number().nullable(),
  unacknowledged: z.number(),
  unresolved: z.number(),
  missingTimestamps: z.number(),
  heatmap: z.array(z.array(z.number())),
  daily: z.array(z.object({ day: z.string(), started: z.number(), resolved: z.number() })),
  incidents: z.array(reportIncidentSchema),
  truncated: z.boolean(),
})
export type Overview = z.infer<typeof overviewSchema>

export const monitorRowSchema = z.object({
  monitorId: z.string(),
  name: z.string(),
  checks: z.number(),
  failedChecks: z.number(),
  availability: z.number().nullable(),
  downtimeSeconds: z.number(),
  incidents: z.number(),
  mttaSeconds: z.number().nullable(),
  mttrSeconds: z.number().nullable(),
})
export type MonitorRow = z.infer<typeof monitorRowSchema>

export const responderRowSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  acknowledged: z.number(),
  resolved: z.number(),
  timeSpentSeconds: z.number(),
})
export type ResponderRow = z.infer<typeof responderRowSchema>

export const notificationRowSchema = z.object({
  channel: z.string(),
  status: z.string(),
  count: z.number(),
})
export type NotificationRow = z.infer<typeof notificationRowSchema>

export interface ReportFilters {
  from: string
  to: string
  monitorId: string
  policyId: string
  acknowledgedBy: string
  resolvedBy: string
  businessHours: boolean
  weekdays: boolean
}
