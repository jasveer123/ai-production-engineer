"use client"

import Link from "next/link"
import { ExternalLink, RotateCw } from "lucide-react"
import { StatusStrip, StorySteps } from "@/components/shared"
import {
  Badge,
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { CHECKS_LABEL, CHECKS_VARIANT, PR_STATUS_VARIANT } from "../constants"
import { usePullRequests, useSyncPullRequest } from "../hooks"

export function FixesPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const pulls = usePullRequests(workspace?.id)
  const sync = useSyncPullRequest(workspace?.id ?? "")

  if (isPending || (workspace && pulls.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = pulls.data ?? []
  const open = items.filter((item) => item.status === "open")
  const merged = items.filter((item) => item.status === "merged")
  const failing = open.filter((item) => item.checksStatus === "failing")
  const canAct = ACTOR_ROLES.includes(workspace.role)

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Fixes" />
      <StatusStrip
        tone={
          failing.length > 0 ? "bad" : open.length > 0 ? "warn" : items.length === 0 ? "idle" : "ok"
        }
        headline={
          items.length === 0
            ? "No fix has shipped yet"
            : failing.length > 0
              ? `${failing.length} fix${failing.length === 1 ? " has" : "es have"} failing checks`
              : open.length > 0
                ? `${open.length} fix${open.length === 1 ? " is" : "es are"} waiting to be merged`
                : "Every fix is merged"
        }
        detail={
          items.length === 0
            ? "When you approve a drafted fix on an incident, its pull request is opened and tracked here."
            : "Pramaan drafts the change, you approve it, your own pipeline checks it."
        }
        stats={[
          { label: "Fixes opened", value: items.length },
          { label: "Open", value: open.length },
          { label: "Checks failing", value: failing.length },
          { label: "Merged", value: merged.length },
        ]}
      />
      {items.length === 0 ? (
        <StorySteps
          heading="How a fix gets to your code"
          steps={[
            {
              title: "Pramaan drafts it",
              text: "From the root cause, on the incident's The fix chapter.",
            },
            { title: "You approve it", text: "Nothing changes until you say yes." },
            {
              title: "A pull request opens",
              text: "Your checks run. Merge it and Pramaan verifies the problem is gone.",
            },
          ]}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pull request</TableHead>
              <TableHead>Incident</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead>Approved by</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="grid gap-0.5">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium hover:text-brand"
                      >
                        {item.title ?? item.branchName} <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="font-medium">{item.title ?? item.branchName}</span>
                    )}
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {item.repositoryFullName}
                      {item.number ? ` #${item.number}` : ""}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {item.incidentId ? (
                    <Link
                      href={ROUTES.incidentDetail(item.incidentId)}
                      className="hover:text-brand"
                    >
                      {item.incidentTitle ?? "Open incident"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      PR_STATUS_VARIANT[item.status as keyof typeof PR_STATUS_VARIANT] ?? "default"
                    }
                  >
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      CHECKS_VARIANT[item.checksStatus as keyof typeof CHECKS_VARIANT] ?? "default"
                    }
                    title={item.checks
                      .map((check) => `${check.name}: ${check.conclusion ?? check.status}`)
                      .join("\n")}
                  >
                    {CHECKS_LABEL[item.checksStatus] ?? item.checksStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.approvedBy ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </TableCell>
                <TableCell>
                  {canAct && item.status === "open" && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(item.id)}
                    >
                      <RotateCw /> Refresh
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
