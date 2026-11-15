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
import { useMonitorsReport } from "../hooks/use-reports"
import { downloadCsv } from "../lib/csv"
import type { ReportFilters } from "../schemas"

interface MonitorsReportProps {
  workspaceId: string
  filters: ReportFilters
}

const percent = (value: number | null) => (value === null ? "-" : `${value.toFixed(3)}%`)

export function MonitorsReport({ workspaceId, filters }: MonitorsReportProps) {
  const report = useMonitorsReport(workspaceId, filters)
  const rows = report.data ?? []

  if (report.isPending) return <Spinner />
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No monitors to report on.</p>

  const exportCsv = () =>
    downloadCsv(
      `monitors-${filters.from}-${filters.to}.csv`,
      [
        "monitor",
        "availability %",
        "checks",
        "failed checks",
        "downtime s",
        "incidents",
        "MTTA s",
        "MTTR s",
      ],
      rows.map((r) => [
        r.name,
        r.availability?.toFixed(4),
        r.checks,
        r.failedChecks,
        r.downtimeSeconds,
        r.incidents,
        r.mttaSeconds,
        r.mttrSeconds,
      ])
    )

  return (
    <div className="grid gap-3">
      <Button size="sm" variant="outline" className="w-fit justify-self-end" onClick={exportCsv}>
        Export CSV
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Monitor</TableHead>
            <TableHead>Availability (SLA)</TableHead>
            <TableHead>Downtime</TableHead>
            <TableHead>Incidents</TableHead>
            <TableHead>MTTA</TableHead>
            <TableHead>MTTR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.monitorId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="font-mono">
                {percent(r.availability)}
                <span className="block text-[0.6875rem] text-muted-foreground">
                  {r.failedChecks} of {r.checks} checks failed
                </span>
              </TableCell>
              <TableCell className="font-mono">{formatSpan(r.downtimeSeconds)}</TableCell>
              <TableCell className="font-mono">{r.incidents}</TableCell>
              <TableCell className="font-mono">{formatSpan(r.mttaSeconds)}</TableCell>
              <TableCell className="font-mono">{formatSpan(r.mttrSeconds)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
