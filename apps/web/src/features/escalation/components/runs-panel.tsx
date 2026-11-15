"use client"

import Link from "next/link"
import { Badge, Eyebrow } from "@/components/ui"
import { DeliveryStateBadge } from "@/features/notifications"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { RUN_STATE_LABEL, SOURCE_LABEL } from "../constants"
import type { Run } from "../schemas"

interface RunsPanelProps {
  runs: Run[]
}

export function RunsPanel({ runs }: RunsPanelProps) {
  return (
    <section className="grid gap-3" aria-label="Recent escalations">
      <Eyebrow>Recent escalations</Eyebrow>
      {runs.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
          Nothing has escalated yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {runs.map((run) => (
            <li key={run.id} className="grid gap-2 border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={ROUTES.incidentDetail(run.incidentId)}
                  className="text-sm font-semibold hover:underline"
                >
                  {run.incidentTitle}
                </Link>
                <Badge>{RUN_STATE_LABEL[run.state] ?? run.state}</Badge>
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">
                {run.policyName} ({SOURCE_LABEL[run.policySource] ?? run.policySource})
                {run.branch ? ` · branch ${run.branch}` : ""} · step{" "}
                {Math.min(run.stepsDone, run.totalSteps)} of {run.totalSteps}
                {run.repeatCount > 0 ? ` · repeat ${run.repeatsDone} of ${run.repeatCount}` : ""} ·
                started {formatRelativeTime(run.startedAt)}
                {run.nextRunAt ? ` · next step ${formatRelativeTime(run.nextRunAt)}` : ""}
              </p>
              {run.deliveries.length > 0 && (
                <ul className="grid gap-1">
                  {run.deliveries.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                      <DeliveryStateBadge state={d.state} />
                      <span>{d.recipientName ?? d.address}</span>
                      <span className="font-mono text-[0.75rem] text-muted-foreground">
                        {d.channel} · {d.address}
                      </span>
                      {d.error && <span className="text-[0.75rem] text-danger">{d.error}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
