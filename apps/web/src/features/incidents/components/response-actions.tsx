"use client"

import { useRouter } from "next/navigation"
import { Button, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { ROUTES } from "@/lib/constants/routes"
import { useRemoveIncident, useRespond, useUpdateIncident } from "../hooks"
import type { Incident } from "../schemas"
import { EscalateButton } from "./escalate-button"
import { PromptDialog } from "./prompt-dialog"

interface ResponseActionsProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
  canRemove: boolean
}

export function ResponseActions({
  workspaceId,
  incident,
  canAct,
  canRemove,
}: ResponseActionsProps) {
  const router = useRouter()
  const respond = useRespond(workspaceId, incident.id)
  const update = useUpdateIncident(workspaceId, incident.id)
  const remove = useRemoveIncident(workspaceId, incident.id)
  const state = incident.responseState
  const act = (action: "acknowledge" | "unacknowledge" | "resolve" | "reopen", reason?: string) =>
    respond.mutate({ action, expectedVersion: incident.version, ...(reason ? { reason } : {}) })

  if (!canAct) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "open" && (
        <Button size="sm" disabled={respond.isPending} onClick={() => act("acknowledge")}>
          {respond.isPending && <Spinner />} Acknowledge
        </Button>
      )}
      {state === "acknowledged" && (
        <Button
          size="sm"
          variant="outline"
          disabled={respond.isPending}
          onClick={() => act("unacknowledge")}
        >
          Unacknowledge
        </Button>
      )}
      {state !== "resolved" && (
        <PromptDialog
          triggerLabel="Resolve"
          title="Resolve incident"
          description="Paging stops and the incident closes. The AI investigation, if any, stops changing its state."
          fieldLabel="Reason (optional)"
          confirmLabel="Resolve"
          variant="secondary"
          pending={respond.isPending}
          onConfirm={(reason) => act("resolve", reason)}
        />
      )}
      {state === "resolved" && (
        <PromptDialog
          triggerLabel="Reopen"
          title="Reopen incident"
          description="The incident becomes ongoing again and needs a fresh acknowledgement."
          fieldLabel="Reason (optional)"
          confirmLabel="Reopen"
          pending={respond.isPending}
          onConfirm={(reason) => act("reopen", reason)}
        />
      )}
      {state === "open" && <EscalateButton workspaceId={workspaceId} incidentId={incident.id} />}
      <PromptDialog
        triggerLabel="Rename"
        title="Rename incident"
        description="The new name shows on the list, the timeline and notifications."
        fieldLabel="Name"
        confirmLabel="Save"
        initial={incident.title}
        required
        pending={update.isPending}
        onConfirm={(title) => update.mutate({ title, expectedVersion: incident.version })}
      />
      {canRemove && (
        <ConfirmDialog
          triggerLabel="Remove"
          title="Remove this incident?"
          description="The incident, its timeline and its AI work are deleted for good."
          confirmLabel="Remove"
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(undefined, { onSuccess: () => router.push(ROUTES.incidents) })
          }
        />
      )}
    </div>
  )
}
