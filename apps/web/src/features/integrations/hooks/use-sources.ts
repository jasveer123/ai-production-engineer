import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { POLL_INTERVAL_MS } from "../constants"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useSources(workspaceId: string) {
  const queryClient = useQueryClient()
  const key = INTEGRATIONS_QUERY_KEYS.sources(workspaceId)
  const sources = useQuery({
    queryKey: key,
    queryFn: () => ingestService.sources(workspaceId),
    refetchInterval: POLL_INTERVAL_MS.OVERVIEW,
  })
  const setPaused = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      ingestService.setPaused(workspaceId, id, paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return { sources, setPaused }
}
