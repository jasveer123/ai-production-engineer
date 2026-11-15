import { z } from "zod"

const brandingShape = {
  logoUrl: z.string().nullable(),
  logoDarkUrl: z.string().nullable(),
  homepageUrl: z.string().nullable(),
  contactUrl: z.string().nullable(),
  theme: z.enum(["system", "light", "dark"]),
  headerLayout: z.enum(["logo_and_name", "logo_only", "name_only"]),
  hideFromSearch: z.boolean(),
}

export const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  monitorIds: z.array(z.string()),
  customDomain: z.string().nullable(),
  domainToken: z.string().nullable(),
  domainVerified: z.boolean(),
  cnameTarget: z.string(),
  isPrivate: z.boolean(),
  subscribers: z.number(),
  openReports: z.number(),
  createdAt: z.string(),
  ...brandingShape,
})
export type StatusPage = z.infer<typeof pageSchema>

export const resourceSchema = z.object({
  id: z.string(),
  publicName: z.string(),
  explanation: z.string().nullable(),
  monitorIds: z.array(z.string()),
  manualState: z.string().nullable(),
  showHistory: z.boolean(),
  state: z.string(),
})
export type Resource = z.infer<typeof resourceSchema>

export const structureSchema = z.object({
  sections: z.array(
    z.object({ id: z.string(), name: z.string(), resources: z.array(resourceSchema) })
  ),
})
export type Structure = z.infer<typeof structureSchema>

export const reportSchema = z.object({
  id: z.string(),
  title: z.string(),
  state: z.string(),
  auto: z.boolean(),
  affected: z.array(z.object({ resourceId: z.string(), name: z.string(), impact: z.string() })),
  updates: z.array(
    z.object({ id: z.string(), body: z.string(), state: z.string(), createdAt: z.string() })
  ),
  publishedAt: z.string(),
  resolvedAt: z.string().nullable(),
})
export type Report = z.infer<typeof reportSchema>

export const maintenanceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string(),
  phase: z.enum(["upcoming", "in_progress", "completed"]),
  affected: z.array(z.object({ resourceId: z.string(), name: z.string() })),
})
export type Maintenance = z.infer<typeof maintenanceSchema>

export const subscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  state: z.enum(["pending", "confirmed", "unsubscribed"]),
  createdAt: z.string(),
})
export type Subscriber = z.infer<typeof subscriberSchema>

export const notificationSchema = z.object({
  id: z.string(),
  subject: z.string(),
  createdAt: z.string(),
  deliverAfter: z.string(),
  fannedOut: z.boolean(),
  counts: z.object({
    pending: z.number(),
    sent: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
  failures: z.array(z.object({ email: z.string(), error: z.string().nullable() })),
})
export type DeliveryNotice = z.infer<typeof notificationSchema>

const publicResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  explanation: z.string().nullable(),
  state: z.string(),
  showHistory: z.boolean(),
  uptime: z.number().nullable(),
  days: z.array(z.object({ date: z.string(), uptime: z.number().nullable() })),
})
export type PublicResource = z.infer<typeof publicResourceSchema>

export const publicSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  overall: z.string(),
  sections: z.array(
    z.object({ id: z.string(), name: z.string(), resources: z.array(publicResourceSchema) })
  ),
  reports: z.array(reportSchema),
  maintenances: z.array(maintenanceSchema),
  generatedAt: z.string(),
  ...brandingShape,
})
export type PublicStatus = z.infer<typeof publicSchema>

export const historySchema = z.object({
  slug: z.string(),
  name: z.string(),
  month: z.string(),
  reports: z.array(reportSchema),
  maintenances: z.array(maintenanceSchema),
})
export type PublicHistory = z.infer<typeof historySchema>
