import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import type { OperationStats } from "../explore-schemas"
import { formatDuration } from "../lib"

interface OperationsTableProps {
  operations: OperationStats[]
  onPick: (term: string) => void
}

const quote = (value: string) => (/[\s",]/.test(value) ? JSON.stringify(value) : value)

export function OperationsTable({ operations, onPick }: OperationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Operation</TableHead>
          <TableHead>Spans</TableHead>
          <TableHead>Error rate</TableHead>
          <TableHead>p50</TableHead>
          <TableHead>p95</TableHead>
          <TableHead>p99</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {operations.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
              No spans in this time range.
            </TableCell>
          </TableRow>
        )}
        {operations.map((op) => (
          <TableRow key={`${op.service}-${op.operation}`}>
            <TableCell className="max-w-[24rem]">
              <button
                type="button"
                className="grid min-w-0 text-left hover:underline"
                onClick={() =>
                  onPick(`service:${quote(op.service)} operation:${quote(op.operation)}`)
                }
              >
                <span className="truncate font-medium">{op.operation}</span>
                <span className="truncate text-[0.6875rem] text-muted-foreground">
                  {op.service}
                </span>
              </button>
            </TableCell>
            <TableCell className="font-mono">{op.count.toLocaleString()}</TableCell>
            <TableCell className={op.errors > 0 ? "font-mono text-danger" : "font-mono"}>
              {((op.errors / Math.max(1, op.count)) * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="font-mono">{formatDuration(op.p50)}</TableCell>
            <TableCell className="font-mono">{formatDuration(op.p95)}</TableCell>
            <TableCell className="font-mono">{formatDuration(op.p99)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
