import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { METRICS_POLL_MS } from "../constants"
import { metricsService, type MetricAlertBody } from "../services"
import { metricsKeys } from "./use-metrics"

export function useMetricAlerts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: metricsKeys.part(workspaceId ?? "", "alerts"),
    queryFn: () => metricsService.alerts(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: METRICS_POLL_MS,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: metricsKeys.part(workspaceId, "alerts") })
}

export function useCreateMetricAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Alert created" },
    mutationFn: (body: MetricAlertBody) => metricsService.createAlert(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useUpdateMetricAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Alert saved" },
    mutationFn: ({ id, ...body }: Partial<MetricAlertBody> & { id: string; paused?: boolean }) =>
      metricsService.updateAlert(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useCheckMetricAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Alert evaluated" },
    mutationFn: (id: string) => metricsService.checkAlert(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useDeleteMetricAlert(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Alert deleted" },
    mutationFn: (id: string) => metricsService.removeAlert(workspaceId, id),
    onSuccess: refresh,
  })
}
