import { Eyebrow } from "@/components/ui"
import type { ServiceRowData } from "../lib"

interface ServicesKpisProps {
  rows: ServiceRowData[]
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  )

export function ServicesKpis({ rows }: ServicesKpisProps) {
  const receiving = rows.filter((row) => row.status === "receiving").length
  const quiet = rows.filter((row) => row.status === "quiet").length
  const withProblems = rows.filter((row) => row.status === "problem")
  const valued = rows.filter((row) => row.impact !== null)
  const impact = valued.reduce((sum, row) => sum + (row.impact ?? 0), 0)
  const currency = valued[0]?.currency ?? "USD"

  const items = [
    {
      label: "Services connected",
      value: String(rows.length),
      note: "sent logs in the last 24 hours",
    },
    { label: "Receiving now", value: String(receiving), note: "sent logs in the last 15 min" },
    { label: "Quiet", value: String(quiet), note: "nothing for 15 min or more" },
    {
      label: "With a problem",
      value: String(withProblems.length),
      note: withProblems.length ? withProblems.map((row) => row.name).join(", ") : "none open",
      hot: withProblems.length > 0,
    },
    {
      label: "Impact, 7 days",
      value: valued.length ? money(impact, currency) : "-",
      note: valued.length ? "failed requests times your value" : "set a value on a service",
      hot: impact > 0,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="grid content-start gap-1 border border-line bg-panel p-4">
          <Eyebrow>{item.label}</Eyebrow>
          <span className={`font-heading text-2xl font-semibold ${item.hot ? "text-danger" : ""}`}>
            {item.value}
          </span>
          <span className="truncate text-[0.75rem] text-muted-foreground" title={item.note}>
            {item.note}
          </span>
        </div>
      ))}
    </div>
  )
}
