"use client"

import { CodeBlock, Spinner } from "@/components/ui"
import { useIncidentContext, useMemberOptions, useUpdateIncident } from "../hooks"
import type { Incident } from "../schemas"
import { CapturedResponse } from "./captured-response"
import { CopyTextButton } from "./copy-text-button"
import { FactRow } from "./fact-row"
import { MetadataEditor } from "./metadata-editor"
import { OptionSelect } from "./option-select"
import { PromptDialog } from "./prompt-dialog"

interface IncidentFactsProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

export function IncidentFacts({ workspaceId, incident, canAct }: IncidentFactsProps) {
  const context = useIncidentContext(workspaceId, incident.id)
  const members = useMemberOptions(workspaceId)
  const update = useUpdateIncident(workspaceId, incident.id)
  const ctx = context.data
  const people = Object.fromEntries((members.data ?? []).map((m) => [m.userId, m.name ?? m.email]))

  if (context.isPending) return <Spinner />

  return (
    <section aria-label="Incident details" className="grid gap-4 border border-line bg-panel p-5">
      <dl className="grid gap-4">
        <FactRow label="Cause">
          <div className="flex flex-wrap items-start gap-3">
            <p className="max-w-3xl leading-6">{incident.description ?? "No cause written yet."}</p>
            {canAct && (
              <PromptDialog
                triggerLabel="Edit cause"
                title="Cause"
                description="A short sentence on what went wrong."
                fieldLabel="Cause"
                confirmLabel="Save"
                initial={incident.description ?? ""}
                onConfirm={(description) =>
                  update.mutate({
                    description: description || null,
                    expectedVersion: incident.version,
                  })
                }
              />
            )}
          </div>
        </FactRow>
        {ctx?.monitor && (
          <FactRow label="Checked URL">
            <span className="font-mono text-[0.8125rem]">
              {ctx.monitor.method} {ctx.monitor.url ?? "-"}
            </span>
            <span className="text-muted-foreground"> · {ctx.monitor.name}</span>
          </FactRow>
        )}
        <FactRow label="Escalation">
          {ctx && ctx.escalations.length > 0
            ? ctx.escalations
                .map((e) => `${e.policyName}: ${e.state}, step ${e.stepIndex + 1}`)
                .join(" · ")
            : "No escalation policy has run for this incident."}
        </FactRow>
        <FactRow label="Assignee">
          <OptionSelect
            label="Assignee"
            value={incident.assignee?.id ?? ""}
            options={people}
            anyLabel="Nobody"
            className="w-64"
            onChange={(assigneeId) =>
              canAct &&
              update.mutate({ assigneeId: assigneeId || null, expectedVersion: incident.version })
            }
          />
        </FactRow>
        {ctx?.replayCommand && (
          <FactRow label="Replay">
            <div className="flex items-start gap-2">
              <CodeBlock className="min-w-0 flex-1 break-all whitespace-pre-wrap">
                {ctx.replayCommand}
              </CodeBlock>
              <CopyTextButton text={ctx.replayCommand} label="Copy curl command" />
            </div>
          </FactRow>
        )}
        {ctx?.lastResponse && (
          <FactRow label="Response">
            <CapturedResponse response={ctx.lastResponse} />
          </FactRow>
        )}
        <FactRow label="Metadata">
          <MetadataEditor
            workspaceId={workspaceId}
            incidentId={incident.id}
            metadata={incident.metadata ?? ctx?.inheritedMetadata ?? {}}
            inherited={incident.metadata === null}
            canAct={canAct}
          />
        </FactRow>
      </dl>
    </section>
  )
}
