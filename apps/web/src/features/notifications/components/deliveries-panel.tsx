"use client"

import * as React from "react"
import Link from "next/link"
import {
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { DELIVERY_STATES, EVENT_LABEL } from "../constants"
import { useDeliveries } from "../hooks"
import { DeliveryDetail } from "./delivery-detail"
import { DeliveryStateBadge } from "./delivery-state-badge"

interface DeliveriesPanelProps {
  workspaceId: string
}

export function DeliveriesPanel({ workspaceId }: DeliveriesPanelProps) {
  const [state, setState] = React.useState<string | undefined>(undefined)
  const deliveries = useDeliveries(workspaceId, { state })
  const items = deliveries.data ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
        <Chip selected={!state} onClick={() => setState(undefined)}>
          All
        </Chip>
        {DELIVERY_STATES.map((item) => (
          <Chip
            key={item.value}
            selected={state === item.value}
            onClick={() => setState(item.value)}
          >
            {item.label}
          </Chip>
        ))}
      </div>
      {deliveries.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          {state ? "No deliveries in this state." : "Nothing has been sent yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queued</TableHead>
              <TableHead>To</TableHead>
              <TableHead>About</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </TableCell>
                <TableCell>
                  <span className="grid">
                    <span>{item.recipientName ?? item.channelName ?? item.address}</span>
                    <span className="font-mono text-[0.75rem] text-muted-foreground">
                      {item.channel} · {item.address}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {item.incidentId ? (
                    <Link
                      href={ROUTES.incidentDetail(item.incidentId)}
                      className="hover:text-brand"
                    >
                      {EVENT_LABEL[item.eventType] ??
                        (item.eventType === "escalation" ? "Escalation" : item.eventType)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Test message</span>
                  )}
                </TableCell>
                <TableCell>
                  <DeliveryStateBadge state={item.state} />
                </TableCell>
                <TableCell>
                  <DeliveryDetail delivery={item} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
