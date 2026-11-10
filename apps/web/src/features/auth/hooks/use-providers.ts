import { useQuery } from "@tanstack/react-query"
import { STALE_TIME } from "@/lib/query/constants"
import { AUTH_QUERY_KEYS } from "../query-keys"
import { authService } from "../services"

export function useProviders() {
  return useQuery({
    queryKey: AUTH_QUERY_KEYS.providers,
    queryFn: authService.providers,
    staleTime: STALE_TIME.SESSION,
  })
}
