"use client"

import { Badge, Button, Eyebrow, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useFixAction, useFixes } from "../hooks"
import { shortSha } from "../lib"
import type { Incident } from "../schemas"
import { DiffView } from "./diff-view"
import { PullRequestCard } from "./pull-request-card"
import { ValidationRuns } from "./validation-runs"

interface FixPanelProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

export function FixPanel({ workspaceId, incident, canAct }: FixPanelProps) {
  const fixes = useFixes(workspaceId, incident.id)
  const action = useFixAction(workspaceId, incident.id)

  if (fixes.isPending) return <Spinner />

  const data = fixes.data
  const fix = data?.latest ?? null

  if (!fix) {
    return (
      <div className="grid gap-2 border border-dashed border-line p-6">
        <h3 className="font-heading text-base font-semibold">No fix drafted yet</h3>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {data?.phase
            ? `Pramaan is working on a fix (${data.phase.replaceAll("_", " ")}). This page updates by itself.`
            : "Once the cause is clear, Pramaan drafts a code change with a test, checks it, and waits here for your approval."}
        </p>
      </div>
    )
  }

  const hasPullRequest = Boolean(data?.pullRequest)
  const canApprove = canAct && incident.status === "awaiting_review" && !hasPullRequest

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="brand">Version {fix.version}</Badge>
        <Badge>{fix.status.replaceAll("_", " ")}</Badge>
        {fix.repositoryFullName && (
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {fix.repositoryFullName} @ {shortSha(fix.baseCommitSha)}
          </span>
        )}
        <span className="text-[0.8125rem] text-muted-foreground">
          drafted {formatRelativeTime(fix.createdAt)}
        </span>
        {fix.diffStat && (
          <span className="ml-auto font-mono text-[0.75rem]">
            {fix.diffStat.files} files <span className="text-ok">+{fix.diffStat.additions}</span>{" "}
            <span className="text-danger">-{fix.diffStat.deletions}</span>
          </span>
        )}
      </div>
      {fix.statusReason && <p className="text-sm text-muted-foreground">{fix.statusReason}</p>}
      {fix.explanation && (
        <section className="grid gap-2">
          <Eyebrow>What the change does</Eyebrow>
          <p className="text-sm leading-6">{fix.explanation}</p>
        </section>
      )}
      {fix.diff && (
        <section className="grid gap-2">
          <Eyebrow>Code change</Eyebrow>
          <DiffView diff={fix.diff} />
        </section>
      )}
      {fix.test && (
        <section className="grid gap-2">
          <Eyebrow>Test that proves it {fix.testPath ? `· ${fix.testPath}` : ""}</Eyebrow>
          {fix.testRationale && (
            <p className="text-[0.8125rem] text-muted-foreground">{fix.testRationale}</p>
          )}
          <pre className="max-h-72 overflow-auto border border-line bg-sunken p-3 font-mono text-[0.75rem] leading-5">
            {fix.test}
          </pre>
        </section>
      )}
      <ValidationRuns runs={fix.runs} />
      {data?.pullRequest && <PullRequestCard pullRequest={data.pullRequest} />}
      {canAct && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            disabled={!canApprove || action.isPending}
            onClick={() => action.mutate({ action: "approve_pr" })}
          >
            {action.isPending && <Spinner />} Approve and open pull request
          </Button>
          <Button
            variant="outline"
            disabled={action.isPending || hasPullRequest}
            onClick={() => action.mutate({ action: "regenerate" })}
          >
            Draft a new fix
          </Button>
          <Button
            variant="destructive"
            disabled={action.isPending || hasPullRequest}
            onClick={() => action.mutate({ action: "reject" })}
          >
            Reject
          </Button>
          {!canApprove && !hasPullRequest && (
            <span className="self-center text-[0.8125rem] text-muted-foreground">
              Approval opens when the incident is waiting for you.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
