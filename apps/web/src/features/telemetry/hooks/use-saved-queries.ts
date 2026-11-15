import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SavedQuery } from "../explore-schemas"
import { TELEMETRY_QUERY_KEYS } from "../query-keys"
import { exploreService } from "../services"

export function useSavedQueries(workspaceId: string | undefined, signal: SavedQuery["signal"]) {
  const queryClient = useQueryClient()
  const key = TELEMETRY_QUERY_KEYS.saved(workspaceId ?? "", signal)
  const list = useQuery({
    queryKey: key,
    queryFn: () => exploreService.saved(workspaceId!, signal),
    enabled: Boolean(workspaceId),
  })
  const create = useMutation({
    meta: { successMessage: "Query saved" },
    mutationFn: (body: { name: string; query: string; range: string }) =>
      exploreService.createSaved(workspaceId!, { ...body, signal }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const remove = useMutation({
    meta: { successMessage: "Saved query deleted" },
    mutationFn: (id: string) => exploreService.deleteSaved(workspaceId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return { list, create, remove }
}
