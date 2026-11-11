import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RUM_POLL_MS } from "../constants"
import { rumService } from "../services"
import type { FunnelStep } from "../schemas"

const key = (ws: string | undefined, ...rest: unknown[]) => ["rum", ws ?? "", ...rest]

export const useRumApps = (ws: string | undefined) =>
  useQuery({
    queryKey: key(ws, "apps"),
    queryFn: () => rumService.apps(ws!),
    enabled: Boolean(ws),
  })

export const useRumOverview = (ws: string | undefined, appId: string, minutes: number) =>
  useQuery({
    queryKey: key(ws, "overview", appId, minutes),
    queryFn: () => rumService.overview(ws!, { appId: appId || undefined, minutes }),
    enabled: Boolean(ws),
    refetchInterval: RUM_POLL_MS,
  })

export const useRumSessions = (
  ws: string | undefined,
  filters: { appId: string; minutes: number; hasErrors: boolean; q: string; userId?: string }
) =>
  useQuery({
    queryKey: key(ws, "sessions", filters),
    queryFn: () => rumService.sessions(ws!, { ...filters, appId: filters.appId || undefined }),
    enabled: Boolean(ws),
    refetchInterval: RUM_POLL_MS,
  })

export const useRumSession = (ws: string | undefined, id: string) =>
  useQuery({
    queryKey: key(ws, "session", id),
    queryFn: () => rumService.session(ws!, id),
    enabled: Boolean(ws),
  })

export const useRumReplay = (ws: string | undefined, id: string, enabled: boolean) =>
  useQuery({
    queryKey: key(ws, "replay", id),
    queryFn: () => rumService.replay(ws!, id),
    enabled: Boolean(ws) && enabled,
    staleTime: Infinity,
  })

export const useRumUsers = (ws: string | undefined, appId: string, minutes: number) =>
  useQuery({
    queryKey: key(ws, "users", appId, minutes),
    queryFn: () => rumService.users(ws!, { appId: appId || undefined, minutes }),
    enabled: Boolean(ws),
  })

export const useRumEvents = (ws: string | undefined, appId: string, minutes: number) =>
  useQuery({
    queryKey: key(ws, "events", appId, minutes),
    queryFn: () => rumService.events(ws!, { appId: appId || undefined, minutes }),
    enabled: Boolean(ws),
  })

export const useFunnels = (ws: string | undefined) =>
  useQuery({
    queryKey: key(ws, "funnels"),
    queryFn: () => rumService.funnels(ws!),
    enabled: Boolean(ws),
  })

export const useFunnelResult = (ws: string, id: string, minutes: number) =>
  useQuery({
    queryKey: key(ws, "funnel", id, minutes),
    queryFn: () => rumService.funnelResult(ws, id, minutes),
    refetchInterval: RUM_POLL_MS,
  })

function useInvalidate(ws: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["rum", ws] })
}

export function useCreateRumApp(ws: string) {
  const done = useInvalidate(ws)
  return useMutation({
    meta: { successMessage: "Application created" },
    mutationFn: (name: string) => rumService.createApp(ws, name),
    onSuccess: done,
  })
}

export function useRemoveRumApp(ws: string) {
  const done = useInvalidate(ws)
  return useMutation({
    meta: { successMessage: "Application removed" },
    mutationFn: (id: string) => rumService.removeApp(ws, id),
    onSuccess: done,
  })
}

export function useCreateFunnel(ws: string) {
  const done = useInvalidate(ws)
  return useMutation({
    meta: { successMessage: "Funnel created" },
    mutationFn: (body: { appId: string; name: string; steps: FunnelStep[] }) =>
      rumService.createFunnel(ws, body),
    onSuccess: done,
  })
}

export function useRemoveFunnel(ws: string) {
  const done = useInvalidate(ws)
  return useMutation({
    meta: { successMessage: "Funnel deleted" },
    mutationFn: (id: string) => rumService.removeFunnel(ws, id),
    onSuccess: done,
  })
}
