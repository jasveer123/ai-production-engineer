import type { ChartType, MetricSeries } from "../schemas"
import { LineChart } from "./line-chart"
import { MetricChart } from "./metric-chart"
import { SeriesTable } from "./series-table"
import { StatValue } from "./stat-value"

interface WidgetBodyProps {
  series: MetricSeries
  chart: ChartType
}

export function WidgetBody({ series, chart }: WidgetBodyProps) {
  const lines = series.groups ?? [{ key: series.name, buckets: series.buckets }]
  const empty = lines.every((g) => g.buckets.every((b) => b.value === null))
  if (empty)
    return (
      <p className="grid h-32 place-items-center border border-dashed border-line text-center text-sm text-muted-foreground">
        No data for this query in the selected time range.
      </p>
    )
  return (
    <div className="grid gap-2">
      {chart === "stat" && <StatValue series={series} />}
      {chart === "table" && <SeriesTable series={series} />}
      {chart === "bar" && <MetricChart series={series} />}
      {(chart === "line" || chart === "area") && (
        <LineChart series={series} area={chart === "area"} />
      )}
      {series.truncated && (
        <p className="text-[0.75rem] text-warn">
          Too many raw points in this range; the chart covers only the earliest part. Narrow the
          range or add a filter.
        </p>
      )}
    </div>
  )
}
