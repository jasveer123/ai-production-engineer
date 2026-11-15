import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { METRICS_POLL_MS } from "../constants"
import { metricsService } from "../services"
import type { DashboardBody, Widget } from "../schemas"

export const metricsKeys = {
  all: (workspaceId: string) => ["metrics", workspaceId] as const,
  part: (workspaceId: string, part: string) => ["metrics", workspaceId, part] as const,
}

export function useMetricNames(workspaceId: string | undefined) {
  return useQuery({
    queryKey: metricsKeys.part(workspaceId ?? "", "names"),
    queryFn: () => metricsService.names(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: METRICS_POLL_MS,
  })
}

export function useMetricSeries(
  workspaceId: string,
  widget: Pick<Widget, "metric" | "agg" | "service" | "groupBy" | "filters">,
  minutes: number
) {
  return useQuery({
    queryKey: [
      ...metricsKeys.part(workspaceId, "series"),
      widget.metric,
      widget.agg,
      widget.service,
      widget.groupBy,
      widget.filters,
      minutes,
    ],
    queryFn: () =>
      metricsService.series(workspaceId, {
        name: widget.metric,
        agg: widget.agg,
        minutes,
        ...(widget.service ? { service: widget.service } : {}),
        ...(widget.groupBy ? { groupBy: widget.groupBy } : {}),
        ...(widget.filters ? { filters: widget.filters } : {}),
      }),
    refetchInterval: METRICS_POLL_MS,
  })
}

export function useMetricLabels(workspaceId: string, name: string) {
  return useQuery({
    queryKey: [...metricsKeys.part(workspaceId, "labels"), name],
    queryFn: () => metricsService.labels(workspaceId, name),
    enabled: Boolean(name),
  })
}

export function useDashboards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: metricsKeys.part(workspaceId ?? "", "dashboards"),
    queryFn: () => metricsService.dashboards(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useDashboardTemplates(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: metricsKeys.part(workspaceId, "templates"),
    queryFn: () => metricsService.templates(workspaceId),
    enabled,
    staleTime: Infinity,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: metricsKeys.part(workspaceId, "dashboards") })
}

export function useCreateDashboard(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Dashboard created" },
    mutationFn: (body: Partial<DashboardBody> & { name: string }) =>
      metricsService.createDashboard(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useSaveDashboard(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Dashboard saved" },
    mutationFn: (body: Partial<DashboardBody>) =>
      metricsService.updateDashboard(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useDeleteDashboard(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Dashboard deleted" },
    mutationFn: (id: string) => metricsService.removeDashboard(workspaceId, id),
    onSuccess: refresh,
  })
}
