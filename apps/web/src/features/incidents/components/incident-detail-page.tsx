"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { ROUTES } from "@/lib/constants/routes"
import { useIncident } from "../hooks"
import { FixPanel } from "./fix-panel"
import { IncidentHeader } from "./incident-header"
import { InvestigationPanel } from "./investigation-panel"
import { TimelineList } from "./timeline-list"
import { VerificationPanel } from "./verification-panel"

const FIX_TAB_STATUSES = ["fix_proposed", "validation", "awaiting_review", "validation_failed"]

export function IncidentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { workspace, isPending } = useCurrentWorkspace()
  const incident = useIncident(workspace?.id, id)
  const [tab, setTab] = React.useState<string | null>(null)

  if (isPending || (workspace && incident.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  if (!incident.data) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        This incident was not found in your workspace.
      </p>
    )
  }

  const canAct = ACTOR_ROLES.includes(workspace.role)
  const data = incident.data
  const current =
    tab ??
    (FIX_TAB_STATUSES.includes(data.status)
      ? "fix"
      : data.status === "monitoring"
        ? "verification"
        : "investigation")

  return (
    <div className="grid min-w-0 gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={ROUTES.incidents} />}
      >
        <ArrowLeft /> All incidents
      </Button>
      <IncidentHeader workspaceId={workspace.id} incident={data} canAct={canAct} />
      <Tabs value={current} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="investigation">Investigation</TabsTrigger>
          <TabsTrigger value="fix">Fix</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="investigation" className="pt-5">
          <InvestigationPanel workspaceId={workspace.id} incident={data} canAct={canAct} />
        </TabsContent>
        <TabsContent value="fix" className="pt-5">
          <FixPanel workspaceId={workspace.id} incident={data} canAct={canAct} />
        </TabsContent>
        <TabsContent value="verification" className="pt-5">
          <VerificationPanel workspaceId={workspace.id} incidentId={data.id} />
        </TabsContent>
        <TabsContent value="timeline" className="pt-5">
          <TimelineList workspaceId={workspace.id} incidentId={data.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
