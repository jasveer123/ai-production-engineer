"use client"

import { RotateCcw } from "lucide-react"
import { Badge, Button, CodeBlock } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { RECEIPT_VARIANT } from "../constants"
import type { AlertReceipt } from "../schemas"

interface ReceiptRowProps {
  receipt: AlertReceipt
  canReplay: boolean
  pending: boolean
  onReplay: (id: string) => void
}

const OUTCOME_LABEL: Record<string, string> = {
  processed: "Processed",
  pending: "Waiting",
  rejected: "Rejected",
}

export function ReceiptRow({ receipt, canReplay, pending, onReplay }: ReceiptRowProps) {
  return (
    <li className="grid gap-2 border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={RECEIPT_VARIANT[receipt.outcome as keyof typeof RECEIPT_VARIANT] ?? "default"}
          >
            {OUTCOME_LABEL[receipt.outcome] ?? receipt.outcome}
          </Badge>
          {receipt.duplicates > 0 && (
            <Badge variant="warning">
              {receipt.duplicates} duplicate{receipt.duplicates === 1 ? "" : "s"} ignored
            </Badge>
          )}
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {formatDateTime(receipt.receivedAt)}
          </span>
        </div>
        {canReplay && (
          <Button
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => onReplay(receipt.id)}
          >
            <RotateCcw /> Replay
          </Button>
        )}
      </div>
      {receipt.reason && <p className="text-[0.8125rem] text-danger">{receipt.reason}</p>}
      <details>
        <summary className="cursor-pointer text-[0.8125rem] text-muted-foreground">Payload</summary>
        <CodeBlock className="mt-2 max-h-[16rem]">
          {JSON.stringify(receipt.payload, null, 2)}
        </CodeBlock>
      </details>
    </li>
  )
}
