"use client"

import Link from "next/link"
import { Badge, Eyebrow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { RUN_STATE_LABEL } from "../constants"
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
            <li key={run.id} className="grid gap-1 border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`${ROUTES.incidents}/${run.incidentId}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {run.incidentTitle}
                </Link>
                <Badge>{RUN_STATE_LABEL[run.state] ?? run.state}</Badge>
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">
                {run.policyName} · step {Math.min(run.stepsDone, run.totalSteps)} of{" "}
                {run.totalSteps} · started {formatRelativeTime(run.startedAt)}
              </p>
              {run.notifications.length > 0 && (
                <p className="text-[0.8125rem]">
                  Emailed {run.notifications.map((n) => n.name ?? n.email).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
