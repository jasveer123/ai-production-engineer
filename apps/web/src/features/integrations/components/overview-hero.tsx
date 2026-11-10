import { ArrowRight, Pause, Play } from "lucide-react"
import { Button, Card, Tag } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useOpenIncidents, usePullRequests, useUsage } from "../hooks"
import { summarizeUsage } from "../lib"
import type { IngestOverview } from "../schemas"
import { FixFlowCard } from "./fix-flow-card"
import { LogsFlowCard } from "./logs-flow-card"
import { ProblemsFlowCard } from "./problems-flow-card"

interface OverviewHeroProps {
  workspaceId: string
  overview: IngestOverview | undefined
  live: boolean
  onToggleLive: () => void
}

function Arrow() {
  return (
    <li aria-hidden className="hidden items-center justify-center text-line-strong lg:flex">
      <ArrowRight className="size-6" />
    </li>
  )
}

export function OverviewHero({ workspaceId, overview, live, onToggleLive }: OverviewHeroProps) {
  const usage = useUsage(workspaceId, live)
  const incidents = useOpenIncidents(workspaceId, live)
  const pulls = usePullRequests(workspaceId, live)
  const summary = usage.data ? summarizeUsage(usage.data.histogram) : undefined
  const receiving = overview?.streams.some((stream) => stream.state === "receiving") ?? false

  return (
    <Card ticked className="gap-5 [--tick:var(--brand)]" aria-label="Workspace overview">
      <Tag className="absolute -top-3 left-5 z-10">
        {receiving ? "Running" : "Waiting for data"}
      </Tag>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-2">
        <div className="grid max-w-[34rem] gap-1">
          <h2 className="font-heading text-xl leading-tight font-semibold">
            {receiving ? "Everything is flowing" : "Waiting for your first log"}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Your apps send logs. The AI watches them. You approve every fix.
          </p>
        </div>
        <span className="font-mono text-[0.8125rem] text-muted-foreground">
          {usage.dataUpdatedAt
            ? `Updated ${formatRelativeTime(new Date(usage.dataUpdatedAt).toISOString())}`
            : "Loading"}
        </span>
      </div>
      <ol className="grid gap-3 px-5 lg:grid-cols-[1fr_1.5rem_1fr_1.5rem_1fr]">
        <LogsFlowCard usage={summary} overview={overview} />
        <Arrow />
        <ProblemsFlowCard incidents={incidents.data} />
        <Arrow />
        <FixFlowCard incidents={incidents.data} pullRequests={pulls.data} />
      </ol>
      <div className="flex items-center justify-between border-t border-line px-5 pt-3">
        <Button variant="ghost" size="sm" className="text-brand" onClick={onToggleLive}>
          {live ? <Pause /> : <Play />} {live ? "Pause live data" : "Resume live data"}
        </Button>
        <span className="font-mono text-[0.8125rem] text-muted-foreground">
          Live data from your workspace
        </span>
      </div>
    </Card>
  )
}
