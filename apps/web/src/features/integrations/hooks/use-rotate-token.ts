import { useMutation, useQueryClient } from "@tanstack/react-query"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useRotateToken(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Token rotated. The old one stops working." },
    mutationFn: (tokenId: string) => ingestService.rotateToken(workspaceId, tokenId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEYS.overview(workspaceId) }),
  })
}
