"use client"

import { Badge, Eyebrow, Spinner } from "@/components/ui"
import { formatClockTime } from "@/lib/format/relative-time"
import { useRecentLogs } from "../hooks"
import type { LogLine } from "../schemas"

const LEVEL_VARIANT: Record<string, "destructive" | "warning" | "default"> = {
  error: "destructive",
  fatal: "destructive",
  warn: "warning",
}

interface LiveLogsProps {
  workspaceId: string
}

function LogRow({ line }: { line: LogLine }) {
  return (
    <li className="grid grid-cols-[4.5rem_3.5rem_1fr] items-baseline gap-2 px-3 py-1.5 font-mono text-[0.75rem]">
      <span className="text-muted-foreground">{formatClockTime(line.ts)}</span>
      <Badge variant={LEVEL_VARIANT[line.level] ?? "default"}>{line.level}</Badge>
      <span className="min-w-0 truncate" title={line.message}>
        <span className="text-muted-foreground">
          {line.service} · {line.way}{" "}
        </span>
        {line.message}
      </span>
    </li>
  )
}

export function LiveLogs({ workspaceId }: LiveLogsProps) {
  const { data } = useRecentLogs(workspaceId, "")
  const lines = data?.lines ?? []

  return (
    <div className="grid gap-2">
      <Eyebrow>Latest logs in your workspace</Eyebrow>
      {lines.length === 0 ? (
        <div className="flex items-center gap-3 border border-dashed border-line p-4 text-[0.8125rem] text-muted-foreground">
          <Spinner /> Waiting for the first log. This updates by itself.
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line bg-sunken">
          {lines.map((line) => (
            <LogRow key={line.id} line={line} />
          ))}
        </ul>
      )}
    </div>
  )
}
