import { useMutation, useQueryClient } from "@tanstack/react-query"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"

export function useRevokeToken(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Token revoked" },
    mutationFn: (tokenId: string) => ingestService.revokeToken(workspaceId, tokenId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEYS.overview(workspaceId) }),
  })
}
