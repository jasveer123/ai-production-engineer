import { ChartColumn } from "lucide-react"
import { Eyebrow } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { formatCount, summarizeUsage } from "../lib"
import type { HistogramBucket, IngestOverview } from "../schemas"
import { UsageBars } from "./usage-bars"

interface UsagePanelProps {
  buckets: HistogramBucket[] | undefined
  overview: IngestOverview | undefined
}

interface KpiProps {
  label: string
  value: string
  danger?: boolean
}

function Kpi({ label, value, danger }: KpiProps) {
  return (
    <div className="grid gap-1 border-l border-line pl-3">
      <Eyebrow>{label}</Eyebrow>
      <span
        className={`font-heading text-2xl leading-none font-semibold ${danger ? "text-danger" : ""}`}
      >
        {value}
      </span>
    </div>
  )
}

export function UsagePanel({ buckets, overview }: UsagePanelProps) {
  const summary = summarizeUsage(buckets ?? [])
  const peak = summary.all[summary.peakIndex]
  const sources = overview?.streams.filter((stream) => stream.state === "receiving").length ?? 0

  return (
    <section className="grid gap-4" aria-label="Usage">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <ChartColumn className="size-[1.125rem]" /> Usage
        </h2>
        <span className="font-mono text-[0.8125rem] text-muted-foreground">Last hour</span>
      </div>
      <UsageBars
        buckets={summary.all}
        highlightIndex={peak && peak.total > 0 ? summary.peakIndex : undefined}
        label="Logs per minute over the last hour. Red shows errors."
        className="h-40"
      />
      <div className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
        <span>60 min ago</span>
        <span>
          {peak && peak.total > 0
            ? `Busiest minute: ${formatCount(peak.total)} · ${formatRelativeTime(peak.at)}`
            : "No logs in this hour"}
        </span>
        <span>Now</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Logs" value={formatCount(summary.hourTotal)} />
        <Kpi label="Sources" value={String(sources)} />
        <Kpi
          label="Errors"
          value={formatCount(summary.hourErrors)}
          danger={summary.hourErrors > 0}
        />
      </div>
    </section>
  )
}
