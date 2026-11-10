import { Badge } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { INCIDENT_STATUS_LABEL } from "../constants"
import type { Incident } from "../schemas"
import { FlowCard } from "./flow-card"

const FIX_STARTED = ["fix_proposed", "validation", "awaiting_review", "monitoring"]

interface ProblemsFlowCardProps {
  incidents: Incident[] | undefined
}

export function ProblemsFlowCard({ incidents }: ProblemsFlowCardProps) {
  const open = incidents ?? []
  const top = open[0]

  return (
    <FlowCard
      tag="2 · The AI finds the problem"
      tone="ai"
      value={String(open.length)}
      label={open.length === 1 ? "problem found" : "problems found"}
      hint={top ? top.title : "No problems found yet"}
      rows={
        top
          ? [
              { label: "Where", value: top.serviceName ?? "Unknown" },
              { label: "Errors", value: `${top.eventCount} events`, tone: "danger" },
              { label: "First seen", value: formatRelativeTime(top.firstSeenAt) },
              { label: "Status", value: INCIDENT_STATUS_LABEL[top.status] ?? top.status },
            ]
          : undefined
      }
      footer={
        top && (
          <Badge variant={FIX_STARTED.includes(top.status) ? "ai" : "default"}>
            {FIX_STARTED.includes(top.status) ? "Cause found" : "Looking into it"}
          </Badge>
        )
      }
    />
  )
}
