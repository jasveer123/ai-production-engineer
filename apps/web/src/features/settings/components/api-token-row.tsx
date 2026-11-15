"use client"

import { Badge } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { ApiToken } from "../schemas"

interface ApiTokenRowProps {
  token: ApiToken
  workspaceName: string | null
  pending: boolean
  onRevoke: (id: string) => void
}

export function ApiTokenRow({ token, workspaceName, pending, onRevoke }: ApiTokenRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border border-line bg-panel p-3 text-sm">
      <span className="grid gap-1">
        <span>
          <span className="font-medium">{token.name}</span>{" "}
          <span className="font-mono text-[0.75rem] text-muted-foreground">{token.prefix}…</span>
        </span>
        <span className="flex flex-wrap gap-1">
          <Badge>
            {workspaceName ?? (token.workspaceId ? "Other workspace" : "All my workspaces")}
          </Badge>
          {token.scopes.map((scope) => (
            <Badge key={scope} variant="success">
              {scope}
            </Badge>
          ))}
          {token.areas.map((area) => (
            <Badge key={area}>{area}</Badge>
          ))}
        </span>
        <span className="text-[0.75rem] text-muted-foreground">
          {token.lastUsedAt ? `used ${formatRelativeTime(token.lastUsedAt)}` : "never used"} ·{" "}
          {token.expiresAt ? `expires ${formatRelativeTime(token.expiresAt)}` : "no expiry"}
        </span>
      </span>
      <ConfirmDialog
        triggerLabel="Revoke"
        title={`Revoke ${token.name}?`}
        description="Scripts using this token stop working straight away."
        confirmLabel="Revoke token"
        pending={pending}
        onConfirm={() => onRevoke(token.id)}
      />
    </li>
  )
}
