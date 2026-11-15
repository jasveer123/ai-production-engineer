import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { PERIOD_LABEL } from "../constants"
import { formatDuration, formatPercent } from "../format"
import type { Availability } from "../schemas"

interface AvailabilityTableProps {
  rows: Availability[]
}

export function AvailabilityTable({ rows }: AvailabilityTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time period</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead>Downtime</TableHead>
          <TableHead>Incidents</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.period}>
            <TableCell className="font-medium">{PERIOD_LABEL[row.period] ?? row.period}</TableCell>
            <TableCell className="font-mono">{formatPercent(row.availability)}</TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {row.downtimeSeconds ? formatDuration(row.downtimeSeconds) : "none"}
            </TableCell>
            <TableCell className="font-mono text-muted-foreground">{row.incidents}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
