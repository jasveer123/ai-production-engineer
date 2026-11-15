"use client"

import { Button, Spinner } from "@/components/ui"
import { useIncidentAction } from "../hooks"
import type { Incident } from "../schemas"

interface IncidentActionsProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

const CAN_INVESTIGATE = ["detected", "needs_attention", "validation_failed"]

export function IncidentActions({ workspaceId, incident, canAct }: IncidentActionsProps) {
  const action = useIncidentAction(workspaceId, incident.id)

  if (!canAct || !CAN_INVESTIGATE.includes(incident.status)) return null

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={action.isPending}
      onClick={() => action.mutate({ action: "investigate" })}
    >
      {action.isPending && <Spinner />} Investigate with AI
    </Button>
  )
}
