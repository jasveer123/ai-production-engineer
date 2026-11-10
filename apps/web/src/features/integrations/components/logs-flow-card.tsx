import { Status } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { formatCount, formatRate, type UsageSummary } from "../lib"
import type { IngestOverview } from "../schemas"
import { FlowCard } from "./flow-card"
import { UsageBars } from "./usage-bars"

const TOP_STREAMS = 3

interface LogsFlowCardProps {
  usage: UsageSummary | undefined
  overview: IngestOverview | undefined
}

export function LogsFlowCard({ usage, overview }: LogsFlowCardProps) {
  const streams = [...(overview?.streams ?? [])]
    .sort((a, b) => b.lastReceivedAt.localeCompare(a.lastReceivedAt))
    .slice(0, TOP_STREAMS)
  const receiving = overview?.streams.filter((stream) => stream.state === "receiving").length ?? 0

  return (
    <FlowCard
      tag="1 · Logs come in"
      tone="brand"
      value={formatRate(usage?.perMinute ?? 0)}
      label="logs a minute"
      hint={`${formatCount(usage?.hourTotal ?? 0)} in the last hour`}
      chart={
        <UsageBars
          buckets={usage?.recent ?? []}
          label="Logs per minute over the last 30 minutes"
          className="h-9"
        />
      }
      rows={streams.map((stream) => ({
        label: `${stream.serviceName} · ${stream.way}`,
        value: `${formatCount(stream.logCount)} · ${formatRelativeTime(stream.lastReceivedAt)}`,
      }))}
      footer={
        <Status state={receiving > 0 ? "live" : "idle"}>
          {receiving > 0
            ? `Live · ${receiving} source${receiving === 1 ? "" : "s"} connected`
            : "No source connected yet"}
        </Status>
      }
    />
  )
}
