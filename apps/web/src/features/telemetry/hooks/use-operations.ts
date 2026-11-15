import { useQuery } from "@tanstack/react-query"
import type { ExploreParams } from "../explore-schemas"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useOperations(workspaceId: string | undefined, params: ExploreParams) {
  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.operations(workspaceId ?? "", params),
    queryFn: () => exploreService.operations(workspaceId!, params),
    enabled: Boolean(workspaceId),
    retry: false,
  })
}
