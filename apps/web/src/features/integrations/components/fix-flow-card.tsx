import { formatRelativeTime } from "@/lib/format/relative-time"
import { AWAITING_REVIEW_STATUS, CHECKS_LABEL } from "../constants"
import type { Incident, PullRequest } from "../schemas"
import { FlowCard } from "./flow-card"

interface FixFlowCardProps {
  incidents: Incident[] | undefined
  pullRequests: PullRequest[] | undefined
}

export function FixFlowCard({ incidents, pullRequests }: FixFlowCardProps) {
  const waiting = (incidents ?? []).filter((item) => item.status === AWAITING_REVIEW_STATUS)
  const openPull = (pullRequests ?? []).find((item) => item.status === "open")

  return (
    <FlowCard
      tag="3 · You approve the fix"
      tone="warn"
      value={String(waiting.length)}
      label={waiting.length === 1 ? "fix waiting for you" : "fixes waiting for you"}
      hint="Nothing changes until you say yes"
      rows={
        openPull
          ? [
              {
                label: "Pull request",
                value: openPull.number ? `#${openPull.number}` : "Draft",
              },
              {
                label: "Checks",
                value: CHECKS_LABEL[openPull.checksStatus] ?? openPull.checksStatus,
                tone: openPull.checksStatus === "passing" ? "ok" : undefined,
              },
              { label: "Opened", value: formatRelativeTime(openPull.createdAt) },
            ]
          : [{ label: "Pull request", value: "None yet" }]
      }
    />
  )
}
