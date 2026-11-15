"use client"

import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { formatSpan } from "@/features/incidents"
import { useRespondersReport } from "../hooks/use-reports"
import { downloadCsv } from "../lib/csv"
import type { ReportFilters } from "../schemas"

interface RespondersReportProps {
  workspaceId: string
  filters: ReportFilters
}

export function RespondersReport({ workspaceId, filters }: RespondersReportProps) {
  const report = useRespondersReport(workspaceId, filters)
  const rows = report.data ?? []

  if (report.isPending) return <Spinner />
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nobody acknowledged or resolved an incident in this range.
      </p>
    )

  const exportCsv = () =>
    downloadCsv(
      `responders-${filters.from}-${filters.to}.csv`,
      ["name", "email", "acknowledged", "resolved", "time spent s"],
      rows.map((r) => [r.name, r.email, r.acknowledged, r.resolved, r.timeSpentSeconds])
    )

  return (
    <div className="grid gap-3">
      <Button size="sm" variant="outline" className="w-fit justify-self-end" onClick={exportCsv}>
        Export CSV
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Responder</TableHead>
            <TableHead>Acknowledged</TableHead>
            <TableHead>Resolved</TableHead>
            <TableHead>Time spent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                <span className="font-medium">{r.name ?? r.email}</span>
                <span className="block text-[0.6875rem] text-muted-foreground">{r.email}</span>
              </TableCell>
              <TableCell className="font-mono">{r.acknowledged}</TableCell>
              <TableCell className="font-mono">{r.resolved}</TableCell>
              <TableCell className="font-mono">{formatSpan(r.timeSpentSeconds)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-[0.75rem] text-muted-foreground">
        Time spent runs from a person acknowledging an incident until it was resolved.
      </p>
    </div>
  )
}
