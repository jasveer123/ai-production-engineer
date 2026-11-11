"use client"

import { StoryBanner } from "@/components/shared"
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useAlertFeed } from "../hooks"
import { AlertFeed } from "./alert-feed"
import { LogAlertsPanel } from "./log-alerts-panel"
import { RoutesPanel } from "./routes-panel"
import { SourcesPanel } from "./sources-panel"

export function AlertsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const feed = useAlertFeed(workspace?.id, "all")

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const alerts = feed.data ?? []
  const firing = alerts.filter((item) => item.status === "firing" || item.status === "triggered")
  const linked = alerts.filter((item) => item.incidentId).length

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Alerts" />
      <StoryBanner
        tone={firing.length > 0 ? "bad" : alerts.length === 0 ? "idle" : "ok"}
        headline={
          firing.length > 0
            ? `${firing.length} alert${firing.length === 1 ? " is" : "s are"} firing`
            : alerts.length === 0
              ? "No alerts have arrived yet"
              : "Nothing is firing"
        }
        detail={
          alerts.length === 0
            ? "Connect a tool on the Sources tab. Alerts from monitors, logs and your tools land here."
            : "Every alert is grouped, routed and turned into an incident when it matters."
        }
        stats={[
          { label: "Alerts", value: alerts.length },
          { label: "Firing", value: firing.length },
          { label: "Became incidents", value: linked },
          { label: "Sources", value: new Set(alerts.map((item) => item.sourceId)).size },
        ]}
      />
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="log-alerts">Log alerts</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="pt-5">
          <AlertFeed workspaceId={workspace.id} />
        </TabsContent>
        <TabsContent value="log-alerts" className="pt-5">
          <LogAlertsPanel workspaceId={workspace.id} canManage={canManage} />
        </TabsContent>
        <TabsContent value="sources" className="pt-5">
          <SourcesPanel workspaceId={workspace.id} canManage={canManage} heartbeats={false} />
        </TabsContent>
        <TabsContent value="routes" className="pt-5">
          <RoutesPanel workspaceId={workspace.id} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
