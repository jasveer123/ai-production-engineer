"use client"

import { Badge, Eyebrow, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { HEALTH_VARIANT } from "../constants"
import { useSystemStatus } from "../hooks"

interface SystemStatusCardProps {
  workspaceId: string
}

const variantOf = (status: string) =>
  HEALTH_VARIANT[status as keyof typeof HEALTH_VARIANT] ?? "default"

export function SystemStatusCard({ workspaceId }: SystemStatusCardProps) {
  const status = useSystemStatus(workspaceId)

  return (
    <section className="grid gap-3 border border-line bg-panel p-5" aria-label="System status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>System status</Eyebrow>
        {status.data && (
          <span className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
            checked {formatRelativeTime(status.data.checkedAt)}
            <Badge variant={variantOf(status.data.status)}>{status.data.status}</Badge>
          </span>
        )}
      </div>
      {status.isPending && <Spinner />}
      {status.isError && (
        <p className="text-sm text-danger">The status check could not be loaded.</p>
      )}
      {status.data && (
        <ul className="grid divide-y divide-line border border-line">
          {status.data.checks.map((check) => (
            <li
              key={check.name}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <span className="grid gap-0.5">
                <span className="font-medium">{check.name}</span>
                {check.detail && (
                  <span className="text-[0.75rem] text-muted-foreground">{check.detail}</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {check.latencyMs !== null && (
                  <span className="font-mono text-[0.75rem] text-muted-foreground">
                    {check.latencyMs} ms
                  </span>
                )}
                <Badge variant={variantOf(check.status)}>{check.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
