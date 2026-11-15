"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui"
import { Button, Field, Input, Spinner } from "@/components/ui"
import { useSetLimits, useUsage } from "../hooks"

interface UsageLimitsPanelProps {
  workspaceId: string
  isOwner: boolean
}

const toNumber = (value: string) => (value.trim() === "" ? null : Number(value))

export function UsageLimitsPanel({ workspaceId, isOwner }: UsageLimitsPanelProps) {
  const usage = useUsage(workspaceId, true)
  const setLimits = useSetLimits(workspaceId)
  const [budget, setBudget] = React.useState<string | null>(null)
  const [parallel, setParallel] = React.useState<string | null>(null)

  if (usage.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  const data = usage.data
  if (!data) return <p className="text-sm text-muted-foreground">Usage could not be loaded.</p>

  const budgetValue = budget ?? String(data.limits.monthlyAiBudgetUsd ?? "")
  const parallelValue = parallel ?? String(data.limits.maxConcurrentInvestigations ?? "")

  return (
    <div className="grid gap-6">
      {data.blockedReason && (
        <Alert>
          <AlertDescription>{data.blockedReason}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="p-3">Month</th>
              <th className="p-3">Investigations</th>
              <th className="p-3">Tokens in / out</th>
              <th className="p-3">AI cost</th>
              <th className="p-3">Sandbox minutes</th>
            </tr>
          </thead>
          <tbody>
            {data.months.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No usage yet.
                </td>
              </tr>
            )}
            {data.months.map((month) => (
              <tr key={month.month} className="border-t border-line">
                <td className="p-3 font-mono">{month.month}</td>
                <td className="p-3">{month.investigations}</td>
                <td className="p-3">
                  {month.inputTokens.toLocaleString()} / {month.outputTokens.toLocaleString()}
                </td>
                <td className="p-3">${month.aiCostUsd.toFixed(2)}</td>
                <td className="p-3">{month.sandboxMinutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        method="post"
        className="grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setLimits.mutate({
            monthlyAiBudgetUsd: toNumber(budgetValue),
            maxConcurrentInvestigations: toNumber(parallelValue),
          })
        }}
      >
        <Field label="Monthly AI budget in dollars (empty means no limit)" htmlFor="limit-budget">
          <Input
            id="limit-budget"
            type="number"
            min={0}
            disabled={!isOwner}
            value={budgetValue}
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>
        <Field
          label="Investigations at the same time (empty means no limit)"
          htmlFor="limit-parallel"
        >
          <Input
            id="limit-parallel"
            type="number"
            min={1}
            max={100}
            disabled={!isOwner}
            value={parallelValue}
            onChange={(e) => setParallel(e.target.value)}
          />
        </Field>
        <p className="text-[0.8125rem] text-muted-foreground">
          {data.runningInvestigations} investigation(s) running now.
          {!isOwner && " Only the owner can change limits."}
        </p>
        {isOwner && (
          <Button type="submit" size="sm" className="w-fit" disabled={setLimits.isPending}>
            {setLimits.isPending && <Spinner />} Save limits
          </Button>
        )}
      </form>
    </div>
  )
}
