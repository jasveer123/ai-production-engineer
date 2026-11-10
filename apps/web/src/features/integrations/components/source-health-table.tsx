import {
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { STATE_LABEL } from "../constants"
import { formatCount } from "../lib"
import type { IngestOverview } from "../schemas"

const DOT_STATE = { receiving: "live", silent: "waiting", not_set_up: "idle" } as const

interface SourceHealthTableProps {
  overview: IngestOverview | undefined
}

export function SourceHealthTable({ overview }: SourceHealthTableProps) {
  const streams = [...(overview?.streams ?? [])].sort((a, b) =>
    b.lastReceivedAt.localeCompare(a.lastReceivedAt)
  )

  return (
    <section className="grid gap-4" aria-labelledby="health-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="health-title" className="font-heading text-xl font-semibold">
          Source health
        </h2>
        <span className="text-[0.8125rem] text-muted-foreground">Everything received so far</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Logs</TableHead>
            <TableHead>Errors</TableHead>
            <TableHead>Last log</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {streams.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                Nothing has arrived yet. Set up an integration and it will appear here.
              </TableCell>
            </TableRow>
          )}
          {streams.map((stream) => (
            <TableRow
              key={`${stream.way}-${stream.serviceName}-${stream.environment}-${stream.host}`}
            >
              <TableCell className="font-medium">
                {stream.serviceName}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {stream.way} · {stream.environment}
                </span>
              </TableCell>
              <TableCell>
                <Status state={DOT_STATE[stream.state]}>{STATE_LABEL[stream.state]}</Status>
              </TableCell>
              <TableCell className="font-mono">{formatCount(stream.logCount)}</TableCell>
              <TableCell className={stream.errorCount > 0 ? "font-mono text-danger" : "font-mono"}>
                {formatCount(stream.errorCount)}
              </TableCell>
              <TableCell className="font-mono">
                {formatRelativeTime(stream.lastReceivedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
