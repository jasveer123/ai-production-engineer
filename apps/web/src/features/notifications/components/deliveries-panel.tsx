"use client"

import Link from "next/link"
import {
  Badge,
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
import { EVENT_LABEL } from "../constants"
import { useDeliveries } from "../hooks"

interface DeliveriesPanelProps {
  workspaceId: string
}

export function DeliveriesPanel({ workspaceId }: DeliveriesPanelProps) {
  const deliveries = useDeliveries(workspaceId)

  if (deliveries.isPending) return <Spinner />

  const items = deliveries.data ?? []

  if (items.length === 0) {
    return (
      <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        Nothing has been sent yet.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sent</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>About</TableHead>
          <TableHead>Incident</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-muted-foreground">
              {formatRelativeTime(item.createdAt)}
            </TableCell>
            <TableCell>{item.channelName}</TableCell>
            <TableCell>{EVENT_LABEL[item.eventType] ?? item.eventType}</TableCell>
            <TableCell>
              {item.incidentId ? (
                <Link href={ROUTES.incidentDetail(item.incidentId)} className="hover:text-brand">
                  Open
                </Link>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={item.status === "sent" ? "success" : "destructive"}>
                  {item.status}
                </Badge>
                {item.error && <span className="text-[0.75rem] text-danger">{item.error}</span>}
                {item.attempts > 1 && (
                  <span className="text-[0.75rem] text-muted-foreground">
                    {item.attempts} tries
                  </span>
                )}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
