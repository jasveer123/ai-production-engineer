import { useMutation, useQuery } from "@tanstack/react-query"
import { statusService } from "../services"
import type { MaintenanceRequest, ReportRequest, ReportUpdateRequest } from "../requests"
import { statusKeys, useRefreshStatus } from "./use-status"

export function useStructure(workspaceId: string, id: string) {
  return useQuery({
    queryKey: statusKeys.part(workspaceId, id, "structure"),
    queryFn: () => statusService.structure(workspaceId, id),
  })
}

export function useSaveStructure(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Structure saved" },
    mutationFn: (body: unknown) => statusService.saveStructure(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useReports(workspaceId: string, id: string) {
  return useQuery({
    queryKey: statusKeys.part(workspaceId, id, "reports"),
    queryFn: () => statusService.reports(workspaceId, id),
  })
}

export function useCreateReport(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Status update published" },
    mutationFn: (body: ReportRequest) => statusService.createReport(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useReportActions(workspaceId: string, id: string, reportId: string) {
  const refresh = useRefreshStatus(workspaceId)
  return {
    rename: useMutation({
      meta: { successMessage: "Title saved" },
      mutationFn: (title: string) => statusService.editReport(workspaceId, id, reportId, { title }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      meta: { successMessage: "Status update deleted" },
      mutationFn: () => statusService.removeReport(workspaceId, id, reportId),
      onSuccess: refresh,
    }),
    addUpdate: useMutation({
      meta: { successMessage: "Update posted" },
      mutationFn: (body: ReportUpdateRequest) =>
        statusService.addUpdate(workspaceId, id, reportId, body),
      onSuccess: refresh,
    }),
    removeUpdate: useMutation({
      meta: { successMessage: "Update removed" },
      mutationFn: (updateId: string) =>
        statusService.removeUpdate(workspaceId, id, reportId, updateId),
      onSuccess: refresh,
    }),
  }
}

export function useMaintenances(workspaceId: string, id: string) {
  return useQuery({
    queryKey: statusKeys.part(workspaceId, id, "maintenance"),
    queryFn: () => statusService.maintenances(workspaceId, id),
  })
}

export function useCreateMaintenance(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Maintenance scheduled" },
    mutationFn: (body: MaintenanceRequest) =>
      statusService.createMaintenance(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useRemoveMaintenance(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return useMutation({
    meta: { successMessage: "Maintenance removed" },
    mutationFn: (maintenanceId: string) =>
      statusService.removeMaintenance(workspaceId, id, maintenanceId),
    onSuccess: refresh,
  })
}

export function useSubscribers(workspaceId: string, id: string) {
  return useQuery({
    queryKey: statusKeys.part(workspaceId, id, "subscribers"),
    queryFn: () => statusService.subscribers(workspaceId, id),
  })
}

export function useDeliveries(workspaceId: string, id: string) {
  return useQuery({
    queryKey: statusKeys.part(workspaceId, id, "notifications"),
    queryFn: () => statusService.notifications(workspaceId, id),
    refetchInterval: 15_000,
  })
}

export function useSubscriberActions(workspaceId: string, id: string) {
  const refresh = useRefreshStatus(workspaceId)
  return {
    add: useMutation({
      meta: { successMessage: "Confirmation email sent" },
      mutationFn: (email: string) => statusService.addSubscriber(workspaceId, id, email),
      onSuccess: refresh,
    }),
    remove: useMutation({
      meta: { successMessage: "Subscriber removed" },
      mutationFn: (subscriberId: string) =>
        statusService.removeSubscriber(workspaceId, id, subscriberId),
      onSuccess: refresh,
    }),
  }
}
