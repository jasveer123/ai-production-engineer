import { Eyebrow } from "@/components/ui"
import { CLOSED_STATUSES } from "../constants"
import type { Incident } from "../schemas"

interface IncidentKpisProps {
  incidents: Incident[]
}

export function IncidentKpis({ incidents }: IncidentKpisProps) {
  const open = incidents.filter((item) => !CLOSED_STATUSES.includes(item.status))
  const waiting = open.filter((item) => item.status === "awaiting_review")
  const urgent = open.filter((item) => item.severity === "critical" || item.severity === "high")
  const watching = open.filter((item) => item.status === "monitoring")
  const resolved = incidents.filter((item) => item.status === "resolved")

  const items = [
    { label: "Open", value: open.length, note: "not resolved or closed", hot: false },
    {
      label: "Waiting for you",
      value: waiting.length,
      note: "a fix needs your review",
      hot: waiting.length > 0,
    },
    {
      label: "Critical or high",
      value: urgent.length,
      note: "open and urgent",
      hot: urgent.length > 0,
    },
    {
      label: "Watching production",
      value: watching.length,
      note: "fix shipped, checking it worked",
      hot: false,
    },
    { label: "Resolved", value: resolved.length, note: "confirmed fixed", hot: false },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="grid content-start gap-1 border border-line bg-panel p-4">
          <Eyebrow>{item.label}</Eyebrow>
          <span className={`font-heading text-2xl font-semibold ${item.hot ? "text-danger" : ""}`}>
            {item.value}
          </span>
          <span className="text-[0.75rem] text-muted-foreground">{item.note}</span>
        </div>
      ))}
    </div>
  )
}
