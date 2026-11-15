"use client"

import * as React from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from "@/components/ui"
import { useEscalate, useIncidentContext, usePolicyOptions } from "../hooks"
import { OptionSelect } from "./option-select"

interface EscalateButtonProps {
  workspaceId: string
  incidentId: string
}

export function EscalateButton({ workspaceId, incidentId }: EscalateButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [policyId, setPolicyId] = React.useState("")
  const context = useIncidentContext(workspaceId, incidentId)
  const policies = usePolicyOptions(workspaceId)
  const escalate = useEscalate(workspaceId, incidentId)
  const running = context.data?.escalations.some((e) => e.state === "running")
  const options = Object.fromEntries((policies.data ?? []).map((p) => [p.id, p.name]))

  if (running) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={escalate.isPending}
        onClick={() => escalate.mutate(undefined)}
      >
        {escalate.isPending && <Spinner />} Escalate
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Escalate</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate this incident</DialogTitle>
          <DialogDescription>
            No escalation is running. Pick a policy and its first step is notified now.
          </DialogDescription>
        </DialogHeader>
        <OptionSelect
          label="Escalation policy"
          value={policyId}
          options={options}
          onChange={setPolicyId}
        />
        <DialogFooter>
          <Button
            disabled={!policyId || escalate.isPending}
            onClick={() => escalate.mutate(policyId, { onSuccess: () => setOpen(false) })}
          >
            {escalate.isPending && <Spinner />} Escalate now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
