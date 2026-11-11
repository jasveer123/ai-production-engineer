import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { METRICS_POLL_MS } from "../constants"
import { metricsService } from "../services"
import type { Widget } from "../schemas"

export function useMetricNames(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["metrics", workspaceId ?? "", "names"],
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
      "metrics",
      workspaceId,
      "series",
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
    queryKey: ["metrics", workspaceId, "labels", name],
    queryFn: () => metricsService.labels(workspaceId, name),
    enabled: Boolean(name),
  })
}

export function useDashboards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["metrics", workspaceId ?? "", "dashboards"],
    queryFn: () => metricsService.dashboards(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["metrics", workspaceId, "dashboards"] })
}

export function useCreateDashboard(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Dashboard created" },
    mutationFn: (name: string) => metricsService.createDashboard(workspaceId, { name }),
    onSuccess: refresh,
  })
}

export function useSaveWidgets(workspaceId: string, id: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Dashboard saved" },
    mutationFn: (widgets: Widget[]) => metricsService.updateDashboard(workspaceId, id, { widgets }),
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
