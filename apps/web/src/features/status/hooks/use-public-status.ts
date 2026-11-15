import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { STATUS_POLL_MS } from "../constants"
import { lookupKey, publicStatusService, storeAccess, type PageLookup } from "../services"

export function usePublicStatus(lookup: PageLookup) {
  return useQuery({
    queryKey: ["status", "public", lookupKey(lookup)],
    queryFn: () => publicStatusService.view(lookup),
    refetchInterval: STATUS_POLL_MS,
    retry: false,
  })
}

export function usePublicHistory(slug: string, month: string) {
  return useQuery({
    queryKey: ["status", "public", lookupKey({ slug }), "history", month],
    queryFn: () => publicStatusService.history(slug, month),
    retry: false,
  })
}

export function usePageAccess(lookup: PageLookup, slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => publicStatusService.access(slug, password),
    onSuccess: ({ token }) => {
      storeAccess(lookupKey(lookup), token)
      storeAccess(lookupKey({ slug }), token)
      return queryClient.invalidateQueries({ queryKey: ["status", "public"] })
    },
  })
}

export function useSubscribe(slug: string) {
  return useMutation({
    mutationFn: (email: string) => publicStatusService.subscribe(slug, email),
  })
}

export function useSubscription(action: "confirm" | "unsubscribe", token: string) {
  return useQuery({
    queryKey: ["status", "subscription", action, token],
    queryFn: () => publicStatusService.subscription(action, token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
}
