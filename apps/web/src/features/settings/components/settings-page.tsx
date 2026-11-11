"use client"

import { StatusStrip } from "@/components/shared"
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ApiTokensPanel } from "./api-tokens-panel"
import { AuditPanel } from "./audit-panel"
import { useMembers } from "../hooks"
import { TeamPanel } from "./team-panel"
import { UsageLimitsPanel } from "./usage-limits-panel"
import { WorkspacePanel } from "./workspace-panel"

export function SettingsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const members = useMembers(workspace?.id)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const isOwner = workspace.role === "owner"
  const team = members.data ?? []

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Settings" />
      <StatusStrip
        tone="ok"
        headline={`${workspace.name} has ${team.length} ${team.length === 1 ? "person" : "people"}`}
        detail="Invite teammates, issue API tokens for your tools, and review everything that changed."
        stats={[
          { label: "Members", value: team.length },
          {
            label: "Owners and admins",
            value: team.filter((m) => m.role === "owner" || m.role === "admin").length,
          },
          { label: "Your role", value: workspace.role },
        ]}
      />
      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="tokens">API tokens</TabsTrigger>
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
        <TabsContent value="tokens" className="pt-5">
          <ApiTokensPanel />
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
