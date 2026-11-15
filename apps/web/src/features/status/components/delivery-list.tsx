"use client"

import { Badge, Eyebrow } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { DeliveryNotice } from "../schemas"

interface DeliveryListProps {
  notices: DeliveryNotice[]
}

export function DeliveryList({ notices }: DeliveryListProps) {
  return (
    <section className="grid gap-2" aria-label="Delivery results">
      <Eyebrow>Delivery results</Eyebrow>
      {notices.length === 0 && (
        <p className="text-[0.8125rem] text-muted-foreground">No emails sent for this page yet.</p>
      )}
      <ul className="grid gap-2">
        {notices.map((n) => (
          <li key={n.id} className="grid gap-1 border border-line bg-panel p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{n.subject}</span>
              <span className="text-[0.75rem] text-muted-foreground">
                {formatRelativeTime(n.createdAt)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!n.fannedOut && <Badge variant="info">queued</Badge>}
              <Badge variant="success">{n.counts.sent} sent</Badge>
              {n.counts.pending > 0 && <Badge variant="warning">{n.counts.pending} pending</Badge>}
              {n.counts.failed > 0 && <Badge variant="destructive">{n.counts.failed} failed</Badge>}
              {n.counts.skipped > 0 && <Badge>{n.counts.skipped} skipped</Badge>}
            </div>
            {n.failures.map((f) => (
              <p key={f.email} className="text-[0.75rem] text-danger">
                {f.email}: {f.error ?? "Delivery failed"}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
