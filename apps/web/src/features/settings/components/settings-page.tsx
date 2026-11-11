"use client"

import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { AuditPanel } from "./audit-panel"
import { TeamPanel } from "./team-panel"
import { UsageLimitsPanel } from "./usage-limits-panel"
import { WorkspacePanel } from "./workspace-panel"

export function SettingsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const isOwner = workspace.role === "owner"

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Settings" />
      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          {canManage && <TabsTrigger value="usage">Usage and limits</TabsTrigger>}
          {canManage && <TabsTrigger value="audit">Activity log</TabsTrigger>}
        </TabsList>
        <TabsContent value="team" className="pt-5">
          <TeamPanel workspaceId={workspace.id} canManage={canManage} myRole={workspace.role} />
        </TabsContent>
        <TabsContent value="workspace" className="pt-5">
          <WorkspacePanel
            workspaceId={workspace.id}
            name={workspace.name}
            canManage={canManage}
            isOwner={isOwner}
          />
        </TabsContent>
        {canManage && (
          <TabsContent value="usage" className="pt-5">
            <UsageLimitsPanel workspaceId={workspace.id} isOwner={isOwner} />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="audit" className="pt-5">
            <AuditPanel workspaceId={workspace.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
