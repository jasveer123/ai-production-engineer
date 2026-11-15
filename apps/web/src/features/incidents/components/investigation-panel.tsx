"use client"

import { Button, Eyebrow, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useIncidentAction, useInvestigation } from "../hooks"
import type { Incident } from "../schemas"
import { EvidenceItem } from "./evidence-item"
import { HypothesisCard } from "./hypothesis-card"

interface InvestigationPanelProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

export function InvestigationPanel({ workspaceId, incident, canAct }: InvestigationPanelProps) {
  const investigation = useInvestigation(workspaceId, incident.id)
  const action = useIncidentAction(workspaceId, incident.id)

  if (investigation.isPending) {
    return <Spinner />
  }

  const data = investigation.data
  const latest = data?.latest ?? null

  if (!latest) {
    return (
      <div className="grid gap-3 border border-dashed border-line p-6">
        <h3 className="font-heading text-base font-semibold">
          {data?.workflow ? "Investigating now" : "Not investigated yet"}
        </h3>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {data?.workflow
            ? `Pramaan is working on it (${data.workflow.phase.replaceAll("_", " ")}). This page updates by itself.`
            : "Pramaan collects the logs, traces and recent deploys around this problem, then explains the most likely cause."}
        </p>
        {canAct && !data?.workflow && (
          <Button
            className="w-fit"
            disabled={action.isPending}
            onClick={() => action.mutate({ action: "investigate" })}
          >
            {action.isPending && <Spinner />} Investigate now
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted-foreground">
        <span>
          Attempt {latest.attempt} of {data?.attempts}
        </span>
        <span>{latest.status.replaceAll("_", " ")}</span>
        {latest.model && <span className="font-mono">{latest.model}</span>}
        {latest.completedAt && <span>finished {formatRelativeTime(latest.completedAt)}</span>}
        {canAct && (
          <Button
            size="xs"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate({ action: "investigate" })}
          >
            Investigate again
          </Button>
        )}
      </div>
      {latest.statusReason && (
        <p className="text-sm text-muted-foreground">{latest.statusReason}</p>
      )}
      {latest.observations.length > 0 && (
        <section className="grid gap-2">
          <Eyebrow>What was seen</Eyebrow>
          <ul className="grid gap-2 text-sm leading-6">
            {latest.observations.map((item) => (
              <li key={item.statement} className="border-l-2 border-line pl-3">
                {item.statement}
                {item.evidence.length > 0 && (
                  <span className="ml-2 font-mono text-[0.75rem] text-muted-foreground">
                    {item.evidence.join(" ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-3">
        <Eyebrow>Likely causes</Eyebrow>
        {latest.hypotheses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cause could be named from the evidence found.
          </p>
        ) : (
          latest.hypotheses.map((item) => (
            <HypothesisCard
              key={item.id}
              workspaceId={workspaceId}
              incidentId={incident.id}
              hypothesis={item}
              canAct={canAct}
            />
          ))
        )}
      </section>
      {latest.dataGaps.length > 0 && (
        <section className="grid gap-2">
          <Eyebrow>What was missing</Eyebrow>
          <ul className="grid gap-1 text-sm">
            {latest.dataGaps.map((gap) => (
              <li key={gap}>· {gap}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-2">
        <Eyebrow>Evidence ({latest.evidence.length})</Eyebrow>
        <ul className="grid gap-2">
          {latest.evidence.map((item) => (
            <EvidenceItem
              key={item.id}
              workspaceId={workspaceId}
              incidentId={incident.id}
              evidence={item}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
