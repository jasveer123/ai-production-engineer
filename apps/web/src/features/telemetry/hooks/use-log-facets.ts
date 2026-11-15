import { useQuery } from "@tanstack/react-query"
import type { ExploreParams } from "../explore-schemas"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useLogFacets(
  workspaceId: string | undefined,
  params: ExploreParams,
  field?: string
) {
  return useQuery({
    queryKey: TELEMETRY_QUERY_KEYS.facets(workspaceId ?? "", params, field),
    queryFn: () => exploreService.facets(workspaceId!, params, field),
    enabled: Boolean(workspaceId),
    retry: false,
    placeholderData: (previous) => previous,
  })
}
