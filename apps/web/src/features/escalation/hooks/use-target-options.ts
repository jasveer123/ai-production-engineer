import { useChannels } from "@/features/notifications"
import { useSchedules, useWorkspaceMembers } from "@/features/oncall"
import { EVERYONE, type TargetOption } from "../draft"

export function useTargetOptions(workspaceId: string): TargetOption[] {
  const schedules = useSchedules(workspaceId)
  const members = useWorkspaceMembers(workspaceId)
  const channels = useChannels(workspaceId)
  return [
    { key: EVERYONE, label: "Entire team" },
    ...(schedules.data ?? []).map((s) => ({
      key: `schedule:${s.id}`,
      label: `On call · ${s.name}`,
    })),
    ...(members.data ?? []).map((m) => ({ key: `user:${m.userId}`, label: m.name ?? m.email })),
    ...(channels.data ?? []).map((c) => ({
      key: `channel:${c.id}`,
      label: `${c.kind} · ${c.name}`,
    })),
  ]
}
