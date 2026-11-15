import { useQuery } from "@tanstack/react-query"
import { IMPACT_DAYS } from "../constants"
import { SERVICES_QUERY_KEYS } from "../query-keys"
import { servicesService } from "../services"

export function useBusinessImpact(workspaceId: string | undefined) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEYS.impact(workspaceId ?? "", IMPACT_DAYS),
    queryFn: () => servicesService.impact(workspaceId!, IMPACT_DAYS),
    enabled: Boolean(workspaceId),
  })
}
