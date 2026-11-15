import { useInfiniteQuery } from "@tanstack/react-query"
import type { ExploreParams } from "../explore-schemas"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useLogExplore(workspaceId: string | undefined, params: ExploreParams) {
  return useInfiniteQuery({
    queryKey: TELEMETRY_QUERY_KEYS.logs(workspaceId ?? "", params),
    queryFn: ({ pageParam }) => exploreService.logs(workspaceId!, params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(workspaceId),
    retry: false,
  })
}
