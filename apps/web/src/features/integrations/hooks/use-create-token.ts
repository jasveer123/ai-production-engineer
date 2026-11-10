import { useMutation, useQueryClient } from "@tanstack/react-query"
import { INTEGRATIONS_QUERY_KEYS } from "../query-keys"
import { ingestService } from "../services"
import type { CreateTokenRequest } from "../schemas"

export function useCreateToken(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Token created" },
    mutationFn: (body: CreateTokenRequest) => ingestService.createToken(workspaceId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEYS.overview(workspaceId) }),
  })
}
