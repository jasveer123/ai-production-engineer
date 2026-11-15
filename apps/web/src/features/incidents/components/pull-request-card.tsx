import { ExternalLink } from "lucide-react"
import { Badge, Eyebrow } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { CHECKS_LABEL, CHECKS_VARIANT, PR_STATUS_VARIANT } from "../constants"
import type { PullRequest } from "../schemas"

interface PullRequestCardProps {
  pullRequest: PullRequest
}

export function PullRequestCard({ pullRequest }: PullRequestCardProps) {
  return (
    <section className="grid gap-3 border border-line p-4">
      <Eyebrow>Pull request</Eyebrow>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            PR_STATUS_VARIANT[pullRequest.status as keyof typeof PR_STATUS_VARIANT] ?? "default"
          }
        >
          {pullRequest.status}
        </Badge>
        <Badge
          variant={
            CHECKS_VARIANT[pullRequest.checksStatus as keyof typeof CHECKS_VARIANT] ?? "default"
          }
        >
          {CHECKS_LABEL[pullRequest.checksStatus] ?? pullRequest.checksStatus}
        </Badge>
        {pullRequest.url ? (
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            {pullRequest.repositoryFullName} #{pullRequest.number}{" "}
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-sm">{pullRequest.title ?? pullRequest.branchName}</span>
        )}
      </div>
      <p className="font-mono text-[0.75rem] text-muted-foreground">
        {pullRequest.branchName} → {pullRequest.baseBranch ?? "default branch"} · opened{" "}
        {formatRelativeTime(pullRequest.createdAt)}
        {pullRequest.approvedBy ? ` · approved by ${pullRequest.approvedBy}` : ""}
        {pullRequest.mergedAt ? ` · merged ${formatRelativeTime(pullRequest.mergedAt)}` : ""}
      </p>
      {pullRequest.checks.length > 0 && (
        <ul className="grid gap-1 text-[0.8125rem]">
          {pullRequest.checks.map((check) => (
            <li key={check.name} className="flex justify-between gap-3">
              <span>{check.name}</span>
              <span className="font-mono text-muted-foreground">
                {check.conclusion ?? check.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
