import { cn } from "@/lib/utils"
import { VITAL_LIMITS } from "../constants"
import type { RumVitalsReport } from "../schemas"
import { formatVital } from "../lib"

interface VitalCardProps {
  vital: RumVitalsReport["vitals"][number]
}

export function VitalCard({ vital }: VitalCardProps) {
  const limit = VITAL_LIMITS[vital.name]
  const total = Math.max(1, vital.samples)
  const tone =
    vital.p75 === null || !limit
      ? "text-muted-foreground"
      : vital.p75 <= limit.good
        ? "text-ok"
        : vital.p75 <= limit.poor
          ? "text-warn"
          : "text-danger"
  const parts = [
    { value: vital.good, className: "bg-ok", label: "good" },
    { value: vital.needsImprovement, className: "bg-warn", label: "needs improvement" },
    { value: vital.poor, className: "bg-danger", label: "poor" },
  ]

  return (
    <article className="grid gap-2 border border-line bg-panel p-4" aria-label={vital.name}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{vital.name}</span>
        <span className="text-[0.75rem] text-muted-foreground">{limit?.label}</span>
      </div>
      <p className={cn("font-heading text-2xl font-semibold", tone)}>
        {formatVital(vital.name, vital.p75)}
        <span className="ml-1 text-[0.75rem] font-normal text-muted-foreground">p75</span>
      </p>
      <div className="flex h-2 overflow-hidden rounded-sm bg-line">
        {parts.map((p) => (
          <span
            key={p.label}
            className={p.className}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.value} ${p.label}`}
          />
        ))}
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        {Math.round((vital.good / total) * 100)}% good · {vital.samples.toLocaleString()} samples
      </p>
    </article>
  )
}
