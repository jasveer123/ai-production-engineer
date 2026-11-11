"use client"

import { Badge, Eyebrow, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { OUTCOME_LABEL } from "../constants"
import { useVerification } from "../hooks"
import { formatDuration, shortSha } from "../lib"

interface VerificationPanelProps {
  workspaceId: string
  incidentId: string
}

const OUTCOME_VARIANT = {
  recovered: "success",
  not_recovered: "destructive",
  inconclusive: "warning",
} as const

export function VerificationPanel({ workspaceId, incidentId }: VerificationPanelProps) {
  const verification = useVerification(workspaceId, incidentId)

  if (verification.isPending) return <Spinner />

  const data = verification.data

  if (!data || (data.runs.length === 0 && !data.awaitingDeploy)) {
    return (
      <div className="grid gap-2 border border-dashed border-line p-6">
        <h3 className="font-heading text-base font-semibold">Nothing to verify yet</h3>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          After the fix is merged and deployed, Pramaan watches production and checks that the error
          stops. The result appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {data.awaitingDeploy && (
        <p className="border border-line bg-panel-2 p-4 text-sm">
          Waiting for the fix to be deployed
          {data.awaitingDeploy.prNumber ? ` (pull request #${data.awaitingDeploy.prNumber})` : ""}
          {data.awaitingDeploy.mergeCommitSha
            ? `, commit ${shortSha(data.awaitingDeploy.mergeCommitSha)}`
            : ""}
          .
        </p>
      )}
      {data.runs.map((run) => (
        <section key={run.id} className="grid gap-3 border border-line p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Check {run.window}</Eyebrow>
            {run.outcome ? (
              <Badge
                variant={OUTCOME_VARIANT[run.outcome as keyof typeof OUTCOME_VARIANT] ?? "default"}
              >
                {OUTCOME_LABEL[run.outcome] ?? run.outcome}
              </Badge>
            ) : (
              <Badge variant="info">Watching production</Badge>
            )}
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              deploy {shortSha(run.deployCommitSha)}
              {run.deployVersion ? ` · ${run.deployVersion}` : ""}
              {run.deployedAt ? ` · ${formatRelativeTime(run.deployedAt)}` : ""}
            </span>
          </div>
          {run.reason && <p className="text-sm text-muted-foreground">{run.reason}</p>}
          <dl className="grid gap-3 sm:grid-cols-2">
            {run.baseline && (
              <div className="grid gap-1">
                <dt className="text-xs font-medium text-muted-foreground">Before the fix</dt>
                <dd className="text-sm">
                  {run.baseline.errors} errors, {run.baseline.errorsPerHour.toFixed(1)} per hour
                </dd>
              </div>
            )}
            {run.observed && (
              <div className="grid gap-1">
                <dt className="text-xs font-medium text-muted-foreground">After the fix</dt>
                <dd className="text-sm">
                  {run.observed.errors} errors over {formatDuration(run.observed.durationMs)}
                  {run.observed.requests !== null ? ` in ${run.observed.requests} requests` : ""}
                </dd>
              </div>
            )}
          </dl>
        </section>
      ))}
    </div>
  )
}
