import { MANAGER_ROLES } from "@/lib/constants/roles"
import { useSession } from "./use-session"

export function useCurrentWorkspace() {
  const { data, isPending } = useSession()
  const workspace = data?.workspaces[0] ?? null

  return {
    workspace,
    isPending,
    canManage: workspace ? MANAGER_ROLES.includes(workspace.role) : false,
  }
}
