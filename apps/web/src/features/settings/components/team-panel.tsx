"use client"

import { Badge, Button, Chip, Eyebrow, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { ROLES } from "../constants"
import {
  useInvitations,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useSetRole,
} from "../hooks"
import { InviteDialog } from "./invite-dialog"

interface TeamPanelProps {
  workspaceId: string
  canManage: boolean
  myRole: string
}

export function TeamPanel({ workspaceId, canManage, myRole }: TeamPanelProps) {
  const members = useMembers(workspaceId)
  const invitations = useInvitations(workspaceId, canManage)
  const setRole = useSetRole(workspaceId)
  const remove = useRemoveMember(workspaceId)
  const revoke = useRevokeInvitation(workspaceId)

  if (members.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          People who can sign in to this workspace. Roles decide what they can change.
        </p>
        {canManage && <InviteDialog workspaceId={workspaceId} />}
      </div>
      <ul className="grid gap-2">
        {(members.data ?? []).map((member) => (
          <li key={member.id} className="grid gap-3 border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid">
                <span className="font-medium">{member.name ?? member.email}</span>
                {member.name && (
                  <span className="text-[0.8125rem] text-muted-foreground">{member.email}</span>
                )}
              </div>
              {canManage ? (
                <ConfirmDialog
                  triggerLabel="Remove"
                  title={`Remove ${member.name ?? member.email}?`}
                  description="They lose access straight away."
                  confirmLabel="Remove member"
                  pending={remove.isPending}
                  onConfirm={() => remove.mutate(member.id)}
                />
              ) : (
                <Badge>{member.role}</Badge>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <Chip
                    key={role}
                    selected={member.role === role}
                    disabled={setRole.isPending || (role === "owner" && myRole !== "owner")}
                    onClick={() => member.role !== role && setRole.mutate({ id: member.id, role })}
                  >
                    {role}
                  </Chip>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (invitations.data ?? []).length > 0 && (
        <section className="grid gap-2" aria-label="Pending invitations">
          <Eyebrow>Pending invitations</Eyebrow>
          <ul className="grid gap-2">
            {(invitations.data ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-line p-3 text-sm"
              >
                <span>
                  {item.email} <Badge>{item.role}</Badge>{" "}
                  <span className="text-[0.75rem] text-muted-foreground">
                    sent {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(item.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
