"use client"

import Link from "next/link"
import { ExternalLink, RotateCw } from "lucide-react"
import {
  Badge,
  Button,
  Eyebrow,
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

  const kpis = [
    { label: "Fixes opened", value: items.length, note: "pull requests Pramaan created" },
    { label: "Open", value: open.length, note: "waiting to be merged", hot: false },
    {
      label: "Checks failing",
      value: failing.length,
      note: "need a look",
      hot: failing.length > 0,
    },
    { label: "Merged", value: merged.length, note: "shipped to your code" },
  ]

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Fixes" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="grid content-start gap-1 border border-line bg-panel p-4"
          >
            <Eyebrow>{item.label}</Eyebrow>
            <span
              className={`font-heading text-2xl font-semibold ${item.hot ? "text-danger" : ""}`}
            >
              {item.value}
            </span>
            <span className="text-[0.75rem] text-muted-foreground">{item.note}</span>
          </div>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No fix has been approved yet. When you approve a drafted fix on an incident, its pull
          request shows up here.
        </p>
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
