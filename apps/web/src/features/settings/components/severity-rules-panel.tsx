"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button, Chip, Eyebrow, Input, Spinner } from "@/components/ui"
import { useSetSeverityRules, useSeverityRules } from "../hooks"
import type { SeverityRule } from "../schemas"

interface SeverityRulesPanelProps {
  workspaceId: string
  canManage: boolean
}

const LEVELS = ["low", "medium", "high", "critical"] as const

export function SeverityRulesPanel({ workspaceId, canManage }: SeverityRulesPanelProps) {
  const saved = useSeverityRules(workspaceId)
  const save = useSetSeverityRules(workspaceId)
  const [draft, setDraft] = React.useState<SeverityRule[] | null>(null)
  const rules = draft ?? saved.data ?? []

  if (saved.isPending) return <Spinner className="size-5" />

  const patch = (index: number, change: Partial<SeverityRule>) =>
    setDraft(rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)))

  return (
    <section className="grid gap-3" aria-label="Severity rules">
      <Eyebrow>How serious new incidents are</Eyebrow>
      <p className="max-w-prose text-[0.8125rem] text-muted-foreground">
        The first rule that matches decides the severity of a new incident. Leave a field empty to
        match anything.
      </p>
      {rules.map((rule, index) => (
        <div key={index} className="grid gap-2 border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {(["environment", "serviceName", "errorType"] as const).map((key) => (
              <Input
                key={key}
                aria-label={key}
                disabled={!canManage}
                value={rule[key] ?? ""}
                placeholder={
                  { environment: "Environment", serviceName: "Service", errorType: "Error type" }[
                    key
                  ]
                }
                onChange={(e) => patch(index, { [key]: e.target.value || undefined })}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <Chip
                  key={level}
                  selected={rule.severity === level}
                  disabled={!canManage}
                  onClick={() => patch(index, { severity: level })}
                >
                  {level}
                </Chip>
              ))}
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove rule ${index + 1}`}
                onClick={() => setDraft(rules.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      ))}
      {canManage && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft([...rules, { severity: "high" }])}
          >
            <Plus /> Add rule
          </Button>
          <Button
            size="sm"
            disabled={draft === null || save.isPending}
            onClick={() => save.mutate(rules, { onSuccess: () => setDraft(null) })}
          >
            {save.isPending && <Spinner />} Save rules
          </Button>
        </div>
      )}
    </section>
  )
}
