import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { IngestToken } from "../schemas"
import { RevokeTokenDialog } from "./revoke-token-dialog"

interface TokenRowProps {
  token: IngestToken
  canManage: boolean
  pending: boolean
  onRotate: (id: string) => void
  onRevoke: (id: string) => void
}

export function TokenRow({ token, canManage, pending, onRotate, onRevoke }: TokenRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="truncate text-[0.8125rem] font-medium">{token.name}</span>
        <span className="font-mono text-[0.75rem] text-muted-foreground">
          {token.masked}
          {" · "}
          {token.lastUsedAt ? `used ${formatRelativeTime(token.lastUsedAt)}` : "never used"}
        </span>
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Button variant="outline" size="xs" disabled={pending} onClick={() => onRotate(token.id)}>
            <RotateCw /> Rotate
          </Button>
          <RevokeTokenDialog
            tokenName={token.name}
            pending={pending}
            onConfirm={() => onRevoke(token.id)}
          />
        </div>
      )}
    </li>
  )
}
