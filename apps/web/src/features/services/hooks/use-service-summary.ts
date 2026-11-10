import { useQuery } from "@tanstack/react-query"
import { SUMMARY_HOURS, SUMMARY_REFRESH_MS } from "../constants"
import { SERVICES_QUERY_KEYS } from "../query-keys"
import { servicesService } from "../services"

export function useServiceSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEYS.summary(workspaceId ?? "", SUMMARY_HOURS),
    queryFn: () => servicesService.summary(workspaceId!, SUMMARY_HOURS),
    enabled: Boolean(workspaceId),
    refetchInterval: SUMMARY_REFRESH_MS,
    placeholderData: (previous) => previous,
  })
}
