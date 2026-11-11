"use client"

import * as React from "react"
import { StatusStrip } from "@/components/shared"
import { Chip, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { RANGES } from "../constants"
import { useRumApps, useRumOverview } from "../hooks"
import { EventsPanel } from "./events-panel"
import { FunnelsPanel } from "./funnels-panel"
import { OverviewPanel } from "./overview-panel"
import { SessionsPanel } from "./sessions-panel"
import { SetupPanel } from "./setup-panel"
import { UsersPanel } from "./users-panel"

export function RumPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const apps = useRumApps(workspace?.id)
  const [minutes, setMinutes] = React.useState<number>(1440)
  const [appId, setAppId] = React.useState("")
  const [tab, setTab] = React.useState("overview")
  const [userId, setUserId] = React.useState<string | undefined>()
  const overview = useRumOverview(workspace?.id, appId, minutes)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null
  const ws = workspace.id
  const list = apps.data ?? []
  const data = overview.data

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Real users" />
      <StatusStrip
        tone={list.length === 0 ? "idle" : (data?.errors ?? 0) > 0 ? "warn" : "ok"}
        headline={
          list.length === 0
            ? "You cannot see what your users see yet"
            : !data || data.sessions === 0
              ? "Waiting for the first visitor"
              : data.errors > 0
                ? `${data.errors} error${data.errors === 1 ? "" : "s"} hit real users`
                : "Your users are having a smooth time"
        }
        detail={
          list.length === 0
            ? "Add one script tag to your site. Pramaan then shows sessions, page speed, errors and replays."
            : "Open a session to replay exactly what a user did before something broke."
        }
        stats={[
          { label: "Sessions", value: data?.sessions ?? 0 },
          { label: "Users", value: data?.users ?? 0 },
          { label: "Page views", value: data?.pageViews ?? 0 },
          { label: "Errors", value: data?.errors ?? 0 },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {list.length > 1 && (
            <>
              <Chip selected={appId === ""} onClick={() => setAppId("")}>
                All applications
              </Chip>
              {list.map((a) => (
                <Chip key={a.id} selected={appId === a.id} onClick={() => setAppId(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Chip
              key={r.minutes}
              selected={minutes === r.minutes}
              onClick={() => setMinutes(r.minutes)}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="funnels">Funnels</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-5">
          <OverviewPanel workspaceId={ws} appId={appId} minutes={minutes} />
        </TabsContent>
        <TabsContent value="sessions" className="pt-5">
          {userId && (
            <button
              type="button"
              className="mb-3 text-[0.8125rem] text-brand-strong hover:underline"
              onClick={() => setUserId(undefined)}
            >
              Showing sessions for {userId} · show everyone
            </button>
          )}
          <SessionsPanel workspaceId={ws} appId={appId} minutes={minutes} userId={userId} />
        </TabsContent>
        <TabsContent value="users" className="pt-5">
          <UsersPanel
            workspaceId={ws}
            appId={appId}
            minutes={minutes}
            onPick={(id) => {
              setUserId(id)
              setTab("sessions")
            }}
          />
        </TabsContent>
        <TabsContent value="events" className="pt-5">
          <EventsPanel workspaceId={ws} appId={appId} minutes={minutes} />
        </TabsContent>
        <TabsContent value="funnels" className="pt-5">
          <FunnelsPanel
            workspaceId={ws}
            minutes={minutes}
            canEdit={ACTOR_ROLES.includes(workspace.role)}
          />
        </TabsContent>
        <TabsContent value="setup" className="pt-5">
          <SetupPanel workspaceId={ws} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
