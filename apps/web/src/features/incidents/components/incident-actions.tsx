"use client"

import { Button, Spinner } from "@/components/ui"
import { MANUAL_TRANSITION_LABEL, TRANSITIONS } from "../constants"
import { useIncidentAction, useTransition } from "../hooks"
import type { Incident } from "../schemas"

interface IncidentActionsProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

const CAN_INVESTIGATE = ["detected", "needs_attention", "validation_failed"]

export function IncidentActions({ workspaceId, incident, canAct }: IncidentActionsProps) {
  const transition = useTransition(workspaceId, incident.id)
  const action = useIncidentAction(workspaceId, incident.id)
  const manual = (TRANSITIONS[incident.status] ?? []).filter((to) => to in MANUAL_TRANSITION_LABEL)
  const busy = transition.isPending || action.isPending

  if (!canAct) return null

  return (
    <div className="flex flex-wrap gap-2">
      {CAN_INVESTIGATE.includes(incident.status) && (
        <Button size="sm" disabled={busy} onClick={() => action.mutate({ action: "investigate" })}>
          {action.isPending && <Spinner />} Investigate now
        </Button>
      )}
      {manual.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "closed_without_fix" ? "outline" : "secondary"}
          disabled={busy}
          onClick={() => transition.mutate({ to, expectedVersion: incident.version })}
        >
          {MANUAL_TRANSITION_LABEL[to]}
        </Button>
      ))}
    </div>
  )
}
