"use client"

import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { AlertFeed } from "./alert-feed"
import { LogAlertsPanel } from "./log-alerts-panel"
import { RoutesPanel } from "./routes-panel"
import { SourcesPanel } from "./sources-panel"

export function AlertsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Alerts" />
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
