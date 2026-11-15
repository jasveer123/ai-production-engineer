import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { formatValue } from "../lib/format"
import type { MetricSeries } from "../schemas"

interface SeriesTableProps {
  series: MetricSeries
}

export function SeriesTable({ series }: SeriesTableProps) {
  const rows = (series.groups ?? [{ key: series.name, buckets: series.buckets }]).map((group) => {
    const values = group.buckets.map((b) => b.value).filter((v): v is number => v !== null)
    return {
      key: group.key,
      latest: values[values.length - 1] ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    }
  })
  const show = (v: number | null) => (v === null ? "No data" : formatValue(v, series.unit))
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Series</TableHead>
          <TableHead>Latest</TableHead>
          <TableHead>Min</TableHead>
          <TableHead>Max</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-mono">{row.key}</TableCell>
            <TableCell className="font-mono">{show(row.latest)}</TableCell>
            <TableCell className="font-mono">{show(row.min)}</TableCell>
            <TableCell className="font-mono">{show(row.max)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
