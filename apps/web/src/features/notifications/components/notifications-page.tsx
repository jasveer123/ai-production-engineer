"use client"

import { StatusStrip } from "@/components/shared"
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useChannels } from "../hooks"
import { ChannelsPanel } from "./channels-panel"
import { DeliveriesPanel } from "./deliveries-panel"

export function NotificationsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const channels = useChannels(workspace?.id)

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

  const list = channels.data ?? []
  const broken = list.filter((item) => item.enabled && item.lastError)

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Notifications" />
      <StatusStrip
        tone={broken.length > 0 ? "warn" : list.length === 0 ? "idle" : "ok"}
        headline={
          broken.length > 0
            ? `${broken.length} channel${broken.length === 1 ? " is" : "s are"} failing to deliver`
            : list.length === 0
              ? "Nobody will hear about incidents yet"
              : "Messages are reaching your team"
        }
        detail={
          list.length === 0
            ? "Add Slack, email, SMS or a webhook so incidents and alerts reach people where they already work."
            : "Open a channel to see what it sends and when it last delivered."
        }
        stats={[
          { label: "Channels", value: list.length },
          { label: "Enabled", value: list.filter((item) => item.enabled).length },
          { label: "Failing", value: broken.length },
        ]}
      />
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
