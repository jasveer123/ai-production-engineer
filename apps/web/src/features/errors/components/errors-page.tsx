"use client"

import * as React from "react"
import Link from "next/link"
import {
  Badge,
  Chip,
  Input,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { STATUS_FILTERS, STATUS_VARIANT } from "../constants"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { useErrors } from "../hooks"
import { ReleasesPanel } from "./releases-panel"
import { SourceMapsPanel } from "./source-maps-panel"

export function ErrorsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [status, setStatus] = React.useState<string>("unresolved")
  const [q, setQ] = React.useState("")
  const [assignee, setAssignee] = React.useState("all")
  const errors = useErrors(workspace?.id, status, q.trim(), assignee)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = errors.data ?? []

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Errors" />
      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="maps">Source maps</TabsTrigger>
        </TabsList>
        <TabsContent value="issues" className="grid gap-6 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((item) => (
                <Chip
                  key={item.value}
                  selected={status === item.value}
                  onClick={() => setStatus(item.value)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Anyone"],
                ["me", "Assigned to me"],
                ["none", "Unassigned"],
              ].map(([value, label]) => (
                <Chip key={value} selected={assignee === value} onClick={() => setAssignee(value!)}>
                  {label}
                </Chip>
              ))}
            </div>
            <Input
              aria-label="Search errors"
              className="w-64"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search errors"
            />
          </div>
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
                          : item.status}
                      </Badge>
                    </div>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {item.service} · {item.environment}
                      {item.assignee
                        ? ` · ${item.assignee.name ?? item.assignee.email}`
                        : ""} · {item.count.toLocaleString()} events · last seen{" "}
                      {formatRelativeTime(item.lastSeenAt)}
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
