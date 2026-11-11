import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notifyError, notifySuccess } from "@/lib/toast"
import { NOTIFICATION_POLL_MS } from "../constants"
import { notificationsService } from "../services"
import type { CreateChannelRequest, UpdateChannelRequest } from "../schemas"

const key = (workspaceId: string, part: string) => ["notifications", workspaceId, part]

export function useChannels(workspaceId: string | undefined) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "channels"),
    queryFn: () => notificationsService.channels(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useDeliveries(workspaceId: string | undefined) {
  return useQuery({
    queryKey: key(workspaceId ?? "", "deliveries"),
    queryFn: () => notificationsService.deliveries(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: NOTIFICATION_POLL_MS,
  })
}

function useRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] })
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
      if (result.ok) notifySuccess("Test message sent")
      else notifyError(new Error(result.error ?? `The receiver answered ${result.status}`))
      void refresh()
    },
  })
}
