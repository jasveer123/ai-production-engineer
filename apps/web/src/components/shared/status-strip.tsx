import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type StatusTone = "ok" | "warn" | "bad" | "idle"

interface StatusFigure {
  label: string
  value: ReactNode
}

interface StatusStripProps {
  tone: StatusTone
  headline: string
  detail?: string
  stats?: StatusFigure[]
  action?: ReactNode
}

const DOT: Record<StatusTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-danger",
  idle: "bg-line-strong",
}

export function StatusStrip({ tone, headline, detail, stats, action }: StatusStripProps) {
  return (
    <section className="grid gap-2 border-y border-line py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
            {headline}
          </h2>
          {detail && <p className="text-[0.8125rem] text-muted-foreground">{detail}</p>}
        </div>
        {action}
      </div>
      {stats && stats.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="font-mono font-medium">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
