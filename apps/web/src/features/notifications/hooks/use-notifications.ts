import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notifyError, notifySuccess } from "@/lib/toast"
import { NOTIFICATION_POLL_MS } from "../constants"
import { notificationsService } from "../services"
import type {
  ContactMethodRequest,
  CreateChannelRequest,
  DeliveryFilter,
  TestResult,
  UpdateChannelRequest,
} from "../schemas"

const key = (workspaceId: string, ...part: unknown[]) => ["notifications", workspaceId, ...part]

export function useChannels(workspaceId: string | undefined) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "channels"),
    queryFn: () => notificationsService.channels(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useDeliveries(workspaceId: string | undefined, filter: DeliveryFilter = {}) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "deliveries", filter),
    queryFn: () => notificationsService.deliveries(workspaceId!, filter),
    enabled: Boolean(workspaceId),
    refetchInterval: NOTIFICATION_POLL_MS,
  })
}

export function useIncidentNotifications(workspaceId: string | undefined, incidentId: string) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "incident", incidentId),
    queryFn: () => notificationsService.forIncident(workspaceId!, incidentId),
    enabled: Boolean(workspaceId),
    refetchInterval: NOTIFICATION_POLL_MS,
  })
}

export function useProviders(workspaceId: string | undefined) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "providers"),
    queryFn: () => notificationsService.providers(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useContactMethods(workspaceId: string | undefined) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "contacts"),
    queryFn: () => notificationsService.contacts(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] })
}

function reportTest(result: TestResult) {
  if (result.state === "delivered") notifySuccess("Test delivered")
  else if (result.state === "provider_accepted")
    notifySuccess(
      `Accepted by the provider${result.providerMessageId ? ` (${result.providerMessageId})` : ""}`
    )
  else if (result.state === "retry_wait")
    notifyError(new Error(`Not delivered yet, will retry: ${result.error ?? "temporary failure"}`))
  else notifyError(new Error(result.error ?? `Not delivered (${result.state})`))
}

export function useCreateChannel(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Channel created" },
    mutationFn: (body: CreateChannelRequest) => notificationsService.create(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useUpdateChannel(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateChannelRequest }) =>
      notificationsService.update(workspaceId, id, body),
    onSuccess: refresh,
  })
}

export function useDeleteChannel(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Channel deleted" },
    mutationFn: (id: string) => notificationsService.remove(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useTestChannel(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: (id: string) => notificationsService.test(workspaceId, id),
    onSuccess: (result) => {
      reportTest(result)
      void refresh()
    },
  })
}

export function useAddContactMethod(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Contact method added" },
    mutationFn: (body: ContactMethodRequest) => notificationsService.addContact(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useRemoveContactMethod(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    meta: { successMessage: "Contact method removed" },
    mutationFn: (id: string) => notificationsService.removeContact(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useTestContactMethod(workspaceId: string) {
  const refresh = useRefresh(workspaceId)
  return useMutation({
    mutationFn: (id: string) => notificationsService.testContact(workspaceId, id),
    onSuccess: (result) => {
      reportTest(result)
      void refresh()
    },
  })
}
