import { useQuery } from "@tanstack/react-query"
import { SUMMARY_REFRESH_MS } from "../constants"
import { SERVICES_QUERY_KEYS } from "../query-keys"
import { servicesService } from "../services"

export function useServiceMap(workspaceId: string | undefined, range: string) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEYS.map(workspaceId ?? "", range),
    queryFn: () => servicesService.map(workspaceId!, range),
    enabled: Boolean(workspaceId),
    refetchInterval: SUMMARY_REFRESH_MS,
    placeholderData: (previous) => previous,
  })
}
