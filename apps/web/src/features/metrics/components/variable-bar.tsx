"use client"

import { Chip, Eyebrow } from "@/components/ui"
import { useMetricLabels } from "../hooks"
import type { DashboardVariable, MetricName } from "../schemas"

interface VariableBarProps {
  workspaceId: string
  metric: MetricName | undefined
  variables: DashboardVariable[]
  values: Record<string, string>
  canEdit: boolean
  onSelect: (key: string, value: string) => void
  onChangeVariables: (variables: DashboardVariable[]) => void
}

export function VariableBar({
  workspaceId,
  metric,
  variables,
  values,
  canEdit,
  onSelect,
  onChangeVariables,
}: VariableBarProps) {
  const labels = useMetricLabels(workspaceId, metric?.name ?? "")
  const options = (key: string) =>
    key === "service"
      ? (metric?.services ?? [])
      : (labels.data?.find((l) => l.key === key)?.values ?? [])
  const unused = ["service", ...(labels.data ?? []).map((l) => l.key)].filter(
    (key) => !variables.some((v) => v.key === key)
  )

  return (
    <div className="grid gap-3">
      {variables.map((variable) => (
        <div
          key={variable.key}
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={variable.label ?? variable.key}
        >
          <Eyebrow>{variable.label ?? variable.key}</Eyebrow>
          <Chip selected={!values[variable.key]} onClick={() => onSelect(variable.key, "")}>
            All
          </Chip>
          {options(variable.key).map((value) => (
            <Chip
              key={value}
              selected={values[variable.key] === value}
              onClick={() => onSelect(variable.key, value)}
            >
              {value}
            </Chip>
          ))}
          {canEdit && (
            <Chip
              onClick={() => onChangeVariables(variables.filter((v) => v.key !== variable.key))}
            >
              Remove filter
            </Chip>
          )}
        </div>
      ))}
      {canEdit && unused.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Add a dashboard filter"
        >
          <Eyebrow>Add a filter</Eyebrow>
          {unused.slice(0, 12).map((key) => (
            <Chip key={key} onClick={() => onChangeVariables([...variables, { key }])}>
              + {key}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
