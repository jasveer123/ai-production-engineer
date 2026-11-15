import { formatRelativeTime } from "@/lib/format/relative-time"
import type { Delivery } from "../schemas"

interface DeliveryDetailProps {
  delivery: Delivery
}

export function DeliveryDetail({ delivery }: DeliveryDetailProps) {
  return (
    <span className="grid gap-0.5 text-[0.75rem] text-muted-foreground">
      {delivery.error && <span className="text-danger">{delivery.error}</span>}
      {delivery.providerMessageId && (
        <span className="font-mono">id {delivery.providerMessageId}</span>
      )}
      {delivery.nextAttemptAt && (
        <span>
          Next try {formatRelativeTime(delivery.nextAttemptAt)} · attempt {delivery.attempts + 1} of{" "}
          {delivery.maxAttempts}
        </span>
      )}
      {!delivery.nextAttemptAt && delivery.attempts > 1 && <span>{delivery.attempts} tries</span>}
      {delivery.deliveredAt && <span>Delivered {formatRelativeTime(delivery.deliveredAt)}</span>}
    </span>
  )
}
