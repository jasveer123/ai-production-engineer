"use client"

import * as React from "react"
import {
  Chip,
  Eyebrow,
  Spinner,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { useAlertFeed } from "../hooks"
import { ALERT_STATUS_FILTERS, type AlertStatusFilter } from "../constants"
import { AlertRow } from "./alert-row"

interface AlertFeedProps {
  workspaceId: string
}

export function AlertFeed({ workspaceId }: AlertFeedProps) {
  const [status, setStatus] = React.useState<AlertStatusFilter>("all")
  const feed = useAlertFeed(workspaceId, status)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Status</Eyebrow>
        {ALERT_STATUS_FILTERS.map((item) => (
          <Chip key={item} selected={status === item} onClick={() => setStatus(item)}>
            {item}
          </Chip>
        ))}
      </div>
      {feed.isPending ? (
        <Spinner />
      ) : (feed.data ?? []).length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No alerts yet. Connect a tool on the Sources tab and send it here.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Times</TableHead>
              <TableHead>Incident</TableHead>
              <TableHead>Last fired</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feed.data!.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
