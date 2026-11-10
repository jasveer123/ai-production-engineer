"use client"

import { Eyebrow } from "@/components/ui"
import { useRevokeToken, useRotateToken } from "../hooks"
import type { IngestToken } from "../schemas"
import type { TokenSecret } from "../types"
import { TokenCreateForm } from "./token-create-form"
import { TokenRow } from "./token-row"
import { TokenSecretNotice } from "./token-secret-notice"

interface TokenPanelProps {
  workspaceId: string
  tokens: IngestToken[]
  canManage: boolean
  secret: TokenSecret | null
  onSecretChange: (secret: TokenSecret | null) => void
}

export function TokenPanel({
  workspaceId,
  tokens,
  canManage,
  secret,
  onSecretChange,
}: TokenPanelProps) {
  const rotate = useRotateToken(workspaceId)
  const revoke = useRevokeToken(workspaceId)
  const activeTokens = tokens.filter((token) => !token.revokedAt)
  const pending = rotate.isPending || revoke.isPending

  const onRotate = (id: string) =>
    rotate.mutate(id, { onSuccess: (rotated) => onSecretChange({ id, token: rotated.token }) })

  const onRevoke = (id: string) =>
    revoke.mutate(id, { onSuccess: () => secret?.id === id && onSecretChange(null) })

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Eyebrow>Your token</Eyebrow>
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          A token tells us which workspace your data belongs to. Keep it private.
        </p>
      </div>
      {secret && <TokenSecretNotice token={secret.token} />}
      {activeTokens.length > 0 && (
        <ul className="grid gap-2">
          {activeTokens.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              canManage={canManage}
              pending={pending}
              onRotate={onRotate}
              onRevoke={onRevoke}
            />
          ))}
        </ul>
      )}
      {canManage ? (
        <TokenCreateForm workspaceId={workspaceId} onCreated={onSecretChange} />
      ) : (
        activeTokens.length === 0 && (
          <p className="text-[0.8125rem] text-muted-foreground">
            Ask an admin or owner of this workspace to create a token.
          </p>
        )
      )}
    </div>
  )
}
