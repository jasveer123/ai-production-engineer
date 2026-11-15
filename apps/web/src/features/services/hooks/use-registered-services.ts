import { useQuery } from "@tanstack/react-query"
import { SERVICES_QUERY_KEYS } from "../query-keys"
import { servicesService } from "../services"

export function useRegisteredServices(workspaceId: string | undefined) {
  return useQuery({
    queryKey: SERVICES_QUERY_KEYS.registered(workspaceId ?? ""),
    queryFn: () => servicesService.registered(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}
