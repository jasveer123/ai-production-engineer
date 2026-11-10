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
  platform: string
  platformName: string
  ingestUrl: string
  tokens: IngestToken[]
  canManage: boolean
  secret: TokenSecret | null
  onSecretChange: (secret: TokenSecret | null) => void
}

export function TokenPanel({
  workspaceId,
  platform,
  platformName,
  ingestUrl,
  tokens,
  canManage,
  secret,
  onSecretChange,
}: TokenPanelProps) {
  const rotate = useRotateToken(workspaceId)
  const revoke = useRevokeToken(workspaceId)
  const activeTokens = tokens.filter((token) => !token.revokedAt)
  const sources = activeTokens.filter((token) => token.platform === platform)
  const older = activeTokens.filter((token) => !token.platform)
  const pending = rotate.isPending || revoke.isPending

  const onRotate = (id: string) =>
    rotate.mutate(id, { onSuccess: (rotated) => onSecretChange({ id, token: rotated.token }) })

  const onRevoke = (id: string) =>
    revoke.mutate(id, { onSuccess: () => secret?.id === id && onSecretChange(null) })

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Eyebrow>Your source</Eyebrow>
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          A source is one {platformName} connection with its own token. Keep the token private.
        </p>
      </div>
      {secret && <TokenSecretNotice token={secret.token} />}
      {sources.length > 0 && (
        <ul className="grid gap-3">
          {sources.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              platformName={platformName}
              ingestUrl={ingestUrl}
              canManage={canManage}
              pending={pending}
              onRotate={onRotate}
              onRevoke={onRevoke}
            />
          ))}
        </ul>
      )}
      {canManage ? (
        <TokenCreateForm
          workspaceId={workspaceId}
          platform={platform}
          defaultName={platformName}
          onCreated={onSecretChange}
        />
      ) : (
        sources.length === 0 && (
          <p className="text-[0.8125rem] text-muted-foreground">
            Ask an admin or owner of this workspace to create a source.
          </p>
        )
      )}
      {older.length > 0 && (
        <details className="border border-line p-3">
          <summary className="cursor-pointer text-[0.8125rem] text-muted-foreground">
            Older workspace tokens ({older.length})
          </summary>
          <ul className="mt-3 grid gap-3">
            {older.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                platformName={null}
                ingestUrl={ingestUrl}
                canManage={canManage}
                pending={pending}
                onRotate={onRotate}
                onRevoke={onRevoke}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
