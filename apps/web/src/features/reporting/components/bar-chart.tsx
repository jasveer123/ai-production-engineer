import { cn } from "@/lib/utils"

interface BarSeries {
  label: string
  tone: "brand" | "ok" | "danger" | "info"
  values: number[]
}

interface BarChartProps {
  labels: string[]
  series: BarSeries[]
  title: string
}

const TONE = { brand: "bg-brand/70", ok: "bg-ok/70", danger: "bg-danger/70", info: "bg-info/70" }

export function BarChart({ labels, series, title }: BarChartProps) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  return (
    <figure className="grid gap-2" aria-label={title}>
      <div className="flex h-40 items-end gap-0.5 border-b border-line">
        {labels.map((label, index) => (
          <div key={label} className="flex h-full flex-1 items-end gap-0.5" title={label}>
            {series.map((s) => (
              <span
                key={s.label}
                title={`${label} · ${s.label}: ${s.values[index] ?? 0}`}
                className={cn("block flex-1", TONE[s.tone])}
                style={{ height: `${((s.values[index] ?? 0) / max) * 100}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-3 text-[0.75rem] text-muted-foreground">
        <span>
          {labels[0]} to {labels[labels.length - 1]}
        </span>
        <span className="flex gap-4">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={cn("size-2", TONE[s.tone])} aria-hidden />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  )
}
