import { z } from "zod"
import { REPORTING_ENDPOINTS, http } from "@/lib/api"
import {
  monitorRowSchema,
  notificationRowSchema,
  overviewSchema,
  responderRowSchema,
  type ReportFilters,
} from "../schemas"

function query(filters: ReportFilters) {
  const optional = Object.entries({
    monitorId: filters.monitorId,
    policyId: filters.policyId,
    acknowledgedBy: filters.acknowledgedBy,
    resolvedBy: filters.resolvedBy,
  }).filter(([, value]) => value)
  return {
    from: new Date(`${filters.from}T00:00:00`).toISOString(),
    to: new Date(`${filters.to}T23:59:59`).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    businessHours: String(filters.businessHours),
    weekdays: String(filters.weekdays),
    ...Object.fromEntries(optional),
  }
}

const get = <T>(
  workspaceId: string,
  report: string,
  filters: ReportFilters,
  schema: z.ZodType<T>
) => http.get<T>(REPORTING_ENDPOINTS.REPORT(workspaceId, report), { query: query(filters), schema })

export const reportingService = {
  incidents: (workspaceId: string, filters: ReportFilters) =>
    get(workspaceId, "incidents", filters, overviewSchema),
  monitors: (workspaceId: string, filters: ReportFilters) =>
    get(workspaceId, "monitors", filters, z.array(monitorRowSchema)),
  responders: (workspaceId: string, filters: ReportFilters) =>
    get(workspaceId, "responders", filters, z.array(responderRowSchema)),
  notifications: (workspaceId: string, filters: ReportFilters) =>
    get(workspaceId, "notifications", filters, z.array(notificationRowSchema)),
}
