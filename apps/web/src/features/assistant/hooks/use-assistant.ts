import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { assistantService } from "../services"

export function useConversations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["assistant", workspaceId ?? "", "list"],
    queryFn: () => assistantService.list(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}

export function useConversation(workspaceId: string | undefined, id: string | null) {
  return useQuery({
    queryKey: ["assistant", workspaceId ?? "", "one", id],
    queryFn: () => assistantService.get(workspaceId!, id!),
    enabled: Boolean(workspaceId && id),
  })
}

export function useAsk(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string | null; message: string }) =>
      id
        ? assistantService.ask(workspaceId, id, message)
        : assistantService.start(workspaceId, message),
    onSuccess: (detail) => {
      queryClient.setQueryData(["assistant", workspaceId, "one", detail.id], detail)
      queryClient.invalidateQueries({ queryKey: ["assistant", workspaceId, "list"] })
    },
  })
}

export function useDeleteConversation(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Conversation deleted" },
    mutationFn: (id: string) => assistantService.remove(workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant", workspaceId] }),
  })
}
