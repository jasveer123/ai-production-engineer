import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ingestService } from "../services"

export function useSendTestLog(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { successMessage: "Test log sent" },
    mutationFn: ingestService.sendTestLog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingest", workspaceId] }),
  })
}
