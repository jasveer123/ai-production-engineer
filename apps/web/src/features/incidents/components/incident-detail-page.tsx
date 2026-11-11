"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { ROUTES } from "@/lib/constants/routes"
import { useIncident } from "../hooks"
import { IncidentHeader } from "./incident-header"
import { IncidentStory } from "./incident-story"

export function IncidentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { workspace, isPending } = useCurrentWorkspace()
  const incident = useIncident(workspace?.id, id)

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
      <IncidentStory workspaceId={workspace.id} incident={data} canAct={canAct} />
    </div>
  )
}
