import { StatusStrip } from "@/components/shared"
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

  const count = (status: string) => open.filter((item) => item.status === status).length
  const fresh = count("detected") + count("needs_attention")
  const working = count("investigating") + count("fix_proposed") + count("validation")
  const headline =
    open.length === 0
      ? "No open incidents"
      : waiting.length > 0
        ? `${waiting.length} fix${waiting.length === 1 ? " is" : "es are"} waiting for your review`
        : fresh > 0
          ? `${fresh} new incident${fresh === 1 ? "" : "s"} to look at`
          : `${open.length} incident${open.length === 1 ? " is" : "s are"} being worked on`
  const parts = [
    [fresh, "new"],
    [working, "being investigated"],
    [waiting.length, "waiting for you"],
    [watching.length, "watching production"],
  ].filter(([n]) => Number(n) > 0)
  const breakdown =
    parts.length > 1 ? `${parts.map(([n, label]) => `${n} ${label}`).join(", ")}. ` : ""

  return (
    <StatusStrip
      tone={urgent.length > 0 ? "bad" : open.length > 0 ? "warn" : "ok"}
      headline={headline}
      detail={
        open.length === 0
          ? "When logs show a new problem, Pramaan opens an incident and starts investigating."
          : `${breakdown}Open one to follow it from what happened to proof it is fixed.`
      }
      stats={[
        { label: "Open", value: open.length },
        { label: "Critical or high", value: urgent.length },
        { label: "Watching production", value: watching.length },
        { label: "Resolved", value: resolved.length },
      ]}
    />
  )
}
