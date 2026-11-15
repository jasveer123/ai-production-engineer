"use client"

import { Field } from "@/components/ui"
import { usePolicies } from "@/features/escalation"
import { SELECT_CLASS } from "../constants"

interface PolicySelectProps {
  id: string
  workspaceId: string
  value: string | null
  onChange: (value: string | null) => void
}

export function PolicySelect({ id, workspaceId, value, onChange }: PolicySelectProps) {
  const policies = usePolicies(workspaceId)
  return (
    <Field
      label="Escalation policy"
      htmlFor={id}
      help={
        policies.data?.length === 0
          ? "No escalation policies yet. Create one under Escalation."
          : "Incidents opened by this source follow the chosen policy."
      }
    >
      <select
        id={id}
        className={SELECT_CLASS}
        value={value ?? ""}
        disabled={policies.isPending}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Use alert routes and the default policy</option>
        {(policies.data ?? []).map((policy) => (
          <option key={policy.id} value={policy.id}>
            {policy.enabled ? policy.name : `${policy.name} (disabled)`}
          </option>
        ))}
      </select>
    </Field>
  )
}
