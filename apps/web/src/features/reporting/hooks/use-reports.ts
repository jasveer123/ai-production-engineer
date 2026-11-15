import { useQuery } from "@tanstack/react-query"
import { REPORTING_QUERY_KEYS } from "../query-keys"
import type { ReportFilters } from "../schemas"
import { reportingService } from "../services/reporting.service"

const options = <T>(
  workspaceId: string,
  report: string,
  filters: ReportFilters,
  fn: () => Promise<T>
) => ({
  queryKey: REPORTING_QUERY_KEYS.report(workspaceId, report, filters),
  queryFn: fn,
  placeholderData: (previous: T | undefined) => previous,
})

export const useIncidentsReport = (workspaceId: string, filters: ReportFilters) =>
  useQuery(
    options(workspaceId, "incidents", filters, () =>
      reportingService.incidents(workspaceId, filters)
    )
  )

export const useMonitorsReport = (workspaceId: string, filters: ReportFilters) =>
  useQuery(
    options(workspaceId, "monitors", filters, () => reportingService.monitors(workspaceId, filters))
  )

export const useRespondersReport = (workspaceId: string, filters: ReportFilters) =>
  useQuery(
    options(workspaceId, "responders", filters, () =>
      reportingService.responders(workspaceId, filters)
    )
  )

export const useNotificationsReport = (workspaceId: string, filters: ReportFilters) =>
  useQuery(
    options(workspaceId, "notifications", filters, () =>
      reportingService.notifications(workspaceId, filters)
    )
  )
