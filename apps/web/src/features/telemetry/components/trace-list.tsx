import Link from "next/link"
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime } from "@/lib/format/relative-time"
import type { TraceSummary } from "../explore-schemas"
import { formatDuration } from "../lib"

interface TraceListProps {
  traces: TraceSummary[]
}

export function TraceList({ traces }: TraceListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Root operation</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Spans</TableHead>
          <TableHead>Services</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {traces.map((trace) => (
          <TableRow key={trace.traceId}>
            <TableCell className="max-w-[24rem]">
              <Link
                href={ROUTES.traceDetail(trace.traceId)}
                className="grid min-w-0 hover:underline"
              >
                <span className="truncate font-medium">
                  {trace.rootOperation ?? "Root span not received"}
                </span>
                <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                  {trace.rootService ?? "unknown service"} · {trace.traceId}
                </span>
              </Link>
            </TableCell>
            <TableCell className="font-mono text-[0.75rem]">
              {formatDateTime(trace.start)}
            </TableCell>
            <TableCell className="font-mono">{formatDuration(trace.durationMs)}</TableCell>
            <TableCell className="font-mono">{trace.spanCount}</TableCell>
            <TableCell className="max-w-[14rem] truncate text-[0.75rem]">
              {trace.services.join(", ")}
            </TableCell>
            <TableCell>
              {trace.error ? <Badge variant="destructive">error</Badge> : <Badge>ok</Badge>}
              {!trace.rootOperation && (
                <Badge variant="warning" className="ml-1">
                  incomplete
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
