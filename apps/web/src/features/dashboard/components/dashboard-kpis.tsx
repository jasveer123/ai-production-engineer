import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Kpi {
  label: string
  value: ReactNode
  note: string
  hot?: boolean
}

interface DashboardKpisProps {
  items: Kpi[]
}

export function DashboardKpis({ items }: DashboardKpisProps) {
  return (
    <dl className="grid grid-cols-2 divide-line border border-line bg-panel lg:grid-cols-4 lg:divide-x [&>div:nth-child(n+3)]:border-t [&>div:nth-child(n+3)]:border-line lg:[&>div:nth-child(n+3)]:border-t-0">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5 px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "font-heading text-2xl font-semibold tabular-nums",
              item.hot && "text-danger"
            )}
          >
            {item.value}
          </dd>
          <span className="truncate text-xs text-muted-foreground" title={item.note}>
            {item.note}
          </span>
        </div>
      ))}
    </dl>
  )
}
