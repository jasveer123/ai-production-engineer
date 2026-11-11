import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { settingsService } from "../services"
import type { SeverityRule } from "../schemas"

const keyOf = (workspaceId: string, part: string) => ["settings", workspaceId, part]

function useQueryFor<T>(
  workspaceId: string | undefined,
  part: string,
  fn: (id: string) => Promise<T>,
  enabled = true
) {
  return useQuery({
    queryKey: keyOf(workspaceId ?? "", part),
    queryFn: () => fn(workspaceId!),
    enabled: Boolean(workspaceId) && enabled,
  })
}

export const useMembers = (id: string | undefined) =>
  useQueryFor(id, "members", settingsService.members)
export const useInvitations = (id: string | undefined, enabled: boolean) =>
  useQueryFor(id, "invitations", settingsService.invitations, enabled)
export const useApproval = (id: string | undefined) =>
  useQueryFor(id, "approval", settingsService.approval)
export const useUsage = (id: string | undefined, enabled: boolean) =>
  useQueryFor(id, "usage", settingsService.usage, enabled)
export const useAudit = (id: string | undefined, enabled: boolean) =>
  useQueryFor(id, "audit", settingsService.audit, enabled)

function useRefresh(workspaceId: string, parts: string[]) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      parts.map((part) => queryClient.invalidateQueries({ queryKey: keyOf(workspaceId, part) }))
    )
}

export function useRenameWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Workspace renamed" },
    mutationFn: (name: string) => settingsService.rename(workspaceId, name),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useSetRole(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["members"])
  return useMutation({
    meta: { successMessage: "Role updated" },
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      settingsService.setRole(workspaceId, id, role),
    onSuccess: refresh,
  })
}

export function useRemoveMember(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["members"])
  return useMutation({
    meta: { successMessage: "Member removed" },
    mutationFn: (id: string) => settingsService.removeMember(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useInvite(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["invitations"])
  return useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      settingsService.invite(workspaceId, body),
    onSuccess: refresh,
  })
}

export function useRevokeInvitation(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["invitations"])
  return useMutation({
    meta: { successMessage: "Invitation revoked" },
    mutationFn: (id: string) => settingsService.revokeInvitation(workspaceId, id),
    onSuccess: refresh,
  })
}

export function useSetApproval(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["approval"])
  return useMutation({
    meta: { successMessage: "Approval rule saved" },
    mutationFn: (role: string) => settingsService.setApproval(workspaceId, role),
    onSuccess: refresh,
  })
}

export function useSetLimits(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["usage"])
  return useMutation({
    meta: { successMessage: "Limits saved" },
    mutationFn: (body: {
      monthlyAiBudgetUsd: number | null
      maxConcurrentInvestigations: number | null
    }) => settingsService.setLimits(workspaceId, body),
    onSuccess: refresh,
  })
}

export const useSeverityRules = (id: string | undefined) =>
  useQueryFor(id, "severity-rules", settingsService.severityRules)

export function useSetSeverityRules(workspaceId: string) {
  const refresh = useRefresh(workspaceId, ["severity-rules"])
  return useMutation({
    meta: { successMessage: "Severity rules saved" },
    mutationFn: (rules: SeverityRule[]) => settingsService.setSeverityRules(workspaceId, rules),
    onSuccess: refresh,
  })
}

export function useApiTokens() {
  return useQuery({ queryKey: ["settings", "api-tokens"], queryFn: settingsService.apiTokens })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: settingsService.createApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "api-tokens"] }),
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { successMessage: "Token revoked" },
    mutationFn: settingsService.revokeApiToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "api-tokens"] }),
  })
}
