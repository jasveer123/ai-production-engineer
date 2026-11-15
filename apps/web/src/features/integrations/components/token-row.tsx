import { Pause, Play, RotateCw } from "lucide-react"
import { Badge, Button } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { getSourceState } from "../lib"
import type { IngestToken } from "../schemas"
import { RevokeTokenDialog } from "./revoke-token-dialog"
import { SourceField } from "./source-field"
import { StateBadge } from "./state-badge"

interface TokenRowProps {
  token: IngestToken
  platformName: string | null
  ingestUrl: string
  canManage: boolean
  pending: boolean
  pausedAt: string | null
  onTogglePause: (id: string) => void
  onRotate: (id: string) => void
  onRevoke: (id: string) => void
}

export function TokenRow({
  token,
  platformName,
  ingestUrl,
  canManage,
  pending,
  pausedAt,
  onTogglePause,
  onRotate,
  onRevoke,
}: TokenRowProps) {
  const state = token.platform ? getSourceState([token], token.platform) : "not_set_up"

  return (
    <li className="grid gap-4 border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{token.name}</span>
          {pausedAt ? (
            <Badge variant="warning">Paused</Badge>
          ) : token.lastUsedAt ? (
            <StateBadge state={state} />
          ) : (
            <Badge>Waiting for data</Badge>
          )}
          <span className="text-[0.8125rem] text-muted-foreground">
            {token.lastUsedAt ? `Last log ${formatRelativeTime(token.lastUsedAt)}` : "Never used"}
          </span>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => onTogglePause(token.id)}
            >
              {pausedAt ? <Play /> : <Pause />} {pausedAt ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => onRotate(token.id)}
            >
              <RotateCw /> Rotate
            </Button>
            <RevokeTokenDialog
              tokenName={token.name}
              pending={pending}
              onConfirm={() => onRevoke(token.id)}
            />
          </div>
        )}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <SourceField label="Platform">{platformName ?? "Any (older workspace token)"}</SourceField>
        <SourceField label="Source ID">{`src_${token.id.slice(0, 8)}`}</SourceField>
        <SourceField label="Source token">{token.masked}</SourceField>
        <SourceField label="Ingest URL">{ingestUrl}</SourceField>
      </dl>
    </li>
  )
}
