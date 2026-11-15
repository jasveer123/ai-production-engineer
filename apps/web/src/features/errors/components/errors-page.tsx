"use client"

import * as React from "react"
import Link from "next/link"
import { Badge, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { StatusStrip } from "@/components/shared"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { STATUS_VARIANT } from "../constants"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { useErrorApps, useErrors } from "../hooks"
import type { ErrorFilters as Filters } from "../schemas"
import { ApplicationsPanel } from "./applications-panel"
import { ErrorFilters } from "./error-filters"
import { ReleasesPanel } from "./releases-panel"
import { SourceMapsPanel } from "./source-maps-panel"

export function ErrorsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const [filters, setFilters] = React.useState<Filters>({
    status: "unresolved",
    q: "",
    assignee: "all",
    applicationId: "",
    environment: "",
    release: "",
  })
  const errors = useErrors(workspace?.id, filters)
  const apps = useErrorApps(workspace?.id)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = errors.data ?? []
  const events = items.reduce((n, item) => n + item.count, 0)
  const regressed = items.filter(
    (item) => item.status === "regressed" || (item.reopenedAt && item.status === "unresolved")
  ).length
  const users = items.reduce((n, item) => n + item.usersAffected, 0)
  const unassigned = items.filter((item) => !item.assignee).length
  const lastSeen = items[0]?.lastSeenAt

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Errors" />
      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="apps">Applications</TabsTrigger>
          <TabsTrigger value="maps">Source maps</TabsTrigger>
        </TabsList>
        <TabsContent value="issues" className="grid gap-6 pt-5">
          <StatusStrip
            tone={items.length === 0 ? "ok" : regressed > 0 ? "bad" : "warn"}
            headline={
              items.length === 0
                ? "No errors in this view"
                : `${items.length} ${items.length === 1 ? "problem is" : "problems are"} hurting your app`
            }
            detail={
              items.length === 0
                ? "Errors from your apps are grouped automatically the moment they are reported."
                : regressed > 0
                  ? `${regressed} came back after being fixed. Open one to see the AI explanation.`
                  : "Open one to see where it happens, who it affects and the AI explanation."
            }
            stats={[
              { label: "Issues", value: items.length },
              { label: "Events", value: events.toLocaleString() },
              { label: "Users affected", value: users.toLocaleString() },
              { label: "Unassigned", value: unassigned },
              { label: "Last seen", value: lastSeen ? formatRelativeTime(lastSeen) : "-" },
            ]}
          />
          <ErrorFilters value={filters} apps={apps.data ?? []} onChange={setFilters} />
          {errors.isPending ? (
            <div className="grid place-items-center py-12">
              <Spinner className="size-5" />
            </div>
          ) : items.length === 0 ? (
            <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
              No errors here. Errors from your apps are grouped automatically once they are
              reported.
            </p>
          ) : (
            <ul className="grid gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={ROUTES.errorDetail(item.id)}
                    className="grid gap-1 border border-line bg-panel p-4 outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{item.title}</span>
                      <Badge variant={STATUS_VARIANT[item.status] ?? "default"}>
                        {item.reopenedAt && item.status === "unresolved"
                          ? "regressed"
                          : item.status === "snoozed" && item.snoozeRemaining
                            ? `snoozed for ${item.snoozeRemaining} events`
                            : item.status}
                      </Badge>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {item.service} · {item.environment}
                      {item.assignee
                        ? ` · ${item.assignee.name ?? item.assignee.email}`
                        : ""} · {item.count.toLocaleString()} events · {item.usersAffected} users ·
                      last seen {formatRelativeTime(item.lastSeenAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="releases" className="pt-5">
          <ReleasesPanel workspaceId={workspace.id} />
        </TabsContent>
        <TabsContent value="apps" className="pt-5">
          <ApplicationsPanel workspaceId={workspace.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="maps" className="pt-5">
          <SourceMapsPanel
            workspaceId={workspace.id}
            canEdit={ACTOR_ROLES.includes(workspace.role)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
