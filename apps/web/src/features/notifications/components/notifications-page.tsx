"use client"

import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ChannelsPanel } from "./channels-panel"
import { DeliveriesPanel } from "./deliveries-panel"

export function NotificationsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  if (!canManage) {
    return (
      <div className="grid min-w-0 gap-6">
        <PageHeading workspaceName={workspace.name} title="Notifications" />
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          Only an admin or owner can manage where messages are sent.
        </p>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Notifications" />
      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="deliveries">History</TabsTrigger>
        </TabsList>
        <TabsContent value="channels" className="pt-5">
          <ChannelsPanel workspaceId={workspace.id} />
        </TabsContent>
        <TabsContent value="deliveries" className="pt-5">
          <DeliveriesPanel workspaceId={workspace.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
