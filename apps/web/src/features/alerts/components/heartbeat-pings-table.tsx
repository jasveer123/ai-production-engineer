import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { formatDurationMs } from "../lib"
import type { HeartbeatPing } from "../schemas"

interface HeartbeatPingsTableProps {
  pings: HeartbeatPing[]
}

const SIGNAL_VARIANT = { success: "success", fail: "destructive", start: "default" } as const

export function HeartbeatPingsTable({ pings }: HeartbeatPingsTableProps) {
  if (pings.length === 0)
    return <p className="text-sm text-muted-foreground">No ping has been received yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Received</TableHead>
          <TableHead>Signal</TableHead>
          <TableHead>Effect</TableHead>
          <TableHead>Execution</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pings.map((ping) => (
          <TableRow key={ping.id}>
            <TableCell className="font-mono text-[0.75rem] text-muted-foreground">
              {formatDateTime(ping.receivedAt)}
            </TableCell>
            <TableCell>
              <Badge
                variant={SIGNAL_VARIANT[ping.signal as keyof typeof SIGNAL_VARIANT] ?? "default"}
              >
                {ping.signal}
              </Badge>
            </TableCell>
            <TableCell className="text-[0.8125rem]">{ping.outcome}</TableCell>
            <TableCell className="font-mono text-[0.75rem]">{ping.executionId ?? ""}</TableCell>
            <TableCell className="text-[0.8125rem]">
              {ping.durationMs !== null ? formatDurationMs(ping.durationMs) : ""}
            </TableCell>
            <TableCell className="max-w-[20rem] truncate text-[0.8125rem]" title={ping.body ?? ""}>
              {ping.body ?? ""}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
