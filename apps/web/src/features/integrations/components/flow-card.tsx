import * as React from "react"
import { cn } from "@/lib/utils"

type FlowTone = "brand" | "ai" | "warn"

const TONE_CLASS: Record<FlowTone, { border: string; text: string }> = {
  brand: { border: "border-brand/50", text: "text-brand" },
  ai: { border: "border-ai/50", text: "text-ai" },
  warn: { border: "border-warn/50", text: "text-warn" },
}

export interface FlowRow {
  label: string
  value: string
  tone?: "danger" | "ok"
}

interface FlowCardProps {
  tag: string
  tone: FlowTone
  value: string
  label: string
  hint?: string
  chart?: React.ReactNode
  rows?: FlowRow[]
  footer?: React.ReactNode
}

const ROW_TONE = { danger: "text-danger", ok: "text-ok" } as const

export function FlowCard({ tag, tone, value, label, hint, chart, rows, footer }: FlowCardProps) {
  const classes = TONE_CLASS[tone]

  return (
    <li className={cn("grid content-start gap-3 border bg-panel p-4", classes.border)}>
      <span className={cn("font-mono text-[0.6875rem] tracking-[0.08em] uppercase", classes.text)}>
        {tag}
      </span>
      <div className="flex items-end gap-3">
        <span className={cn("font-heading text-[2.75rem] leading-none font-bold", classes.text)}>
          {value}
        </span>
        <span className="grid gap-0.5 pb-1 text-sm leading-5">
          <span>{label}</span>
          {hint && <span className="text-[0.8125rem] text-muted-foreground">{hint}</span>}
        </span>
      </div>
      {chart}
      {rows && rows.length > 0 && (
        <dl className="grid gap-1.5 border-t border-line pt-3 text-[0.8125rem]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate text-muted-foreground">{row.label}</dt>
              <dd className={cn("font-mono", row.tone && ROW_TONE[row.tone])}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer}
    </li>
  )
}
