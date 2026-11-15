"use client"

import { StatusStrip } from "@/components/shared"
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useChannels } from "../hooks"
import { ChannelsPanel } from "./channels-panel"
import { ContactMethodsPanel } from "./contact-methods-panel"
import { DeliveriesPanel } from "./deliveries-panel"

export function NotificationsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const channels = useChannels(canManage ? workspace?.id : undefined)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const list = channels.data ?? []
  const broken = list.filter((item) => item.enabled && item.lastError)

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Notifications" />
      {canManage && (
        <StatusStrip
          tone={broken.length > 0 ? "warn" : list.length === 0 ? "idle" : "ok"}
          headline={
            broken.length > 0
              ? `${broken.length} channel${broken.length === 1 ? " is" : "s are"} failing to deliver`
              : list.length === 0
                ? "No shared channels yet"
                : "Channels are delivering"
          }
          detail={
            list.length === 0
              ? "Add Slack, Teams, e-mail, SMS or a webhook so incidents reach people where they already work."
              : "Every message is recorded in the delivery log with its true state."
          }
          stats={[
            { label: "Channels", value: list.length },
            { label: "Enabled", value: list.filter((item) => item.enabled).length },
            { label: "Failing", value: broken.length },
          ]}
        />
      )}
      <Tabs defaultValue={canManage ? "channels" : "contacts"}>
        <TabsList>
          {canManage && <TabsTrigger value="channels">Channels</TabsTrigger>}
          {canManage && <TabsTrigger value="deliveries">Delivery log</TabsTrigger>}
          <TabsTrigger value="contacts">My contact methods</TabsTrigger>
        </TabsList>
        {canManage && (
          <TabsContent value="channels" className="pt-5">
            <ChannelsPanel workspaceId={workspace.id} />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="deliveries" className="pt-5">
            <DeliveriesPanel workspaceId={workspace.id} />
          </TabsContent>
        )}
        <TabsContent value="contacts" className="pt-5">
          <ContactMethodsPanel workspaceId={workspace.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
