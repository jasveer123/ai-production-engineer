import { formatDateTime } from "@/lib/format/relative-time"
import { formatValue } from "../lib/format"
import type { MetricSeries } from "../schemas"

interface StatValueProps {
  series: MetricSeries
}

export function StatValue({ series }: StatValueProps) {
  const last = [...series.buckets].reverse().find((b) => b.value !== null)
  if (!last || last.value === null) return null
  return (
    <div className="grid h-32 content-center gap-1">
      <span className="font-mono text-[2.25rem] leading-none font-semibold">
        {formatValue(last.value, series.unit)}
      </span>
      <span className="text-[0.75rem] text-muted-foreground">
        Latest value, {formatDateTime(last.at)}
      </span>
    </div>
  )
}
