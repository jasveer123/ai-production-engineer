import type { UseFormReturn } from "react-hook-form"
import { usePolicies } from "@/features/escalation"
import type { MonitorFormValues } from "../form-schema"
import { FormSection } from "./form-section"
import { FormSelect } from "./form-select"

interface FormEscalationSectionProps {
  form: UseFormReturn<MonitorFormValues>
  workspaceId: string
}

export function FormEscalationSection({ form, workspaceId }: FormEscalationSectionProps) {
  const policies = usePolicies(workspaceId)
  const options = [
    { value: "", label: "Use alert routes and the default policy" },
    ...(policies.data ?? []).map((policy) => ({
      value: policy.id,
      label: policy.enabled ? policy.name : `${policy.name} (disabled)`,
    })),
  ]
  return (
    <FormSection
      title="On-call escalation"
      description="Who gets paged when this monitor opens an incident."
    >
      <FormSelect
        id="monitor-escalation"
        label="Escalation policy"
        help={
          policies.data?.length === 0
            ? "No escalation policies yet. Create one under Escalation."
            : "Incidents from this monitor follow the chosen policy."
        }
        options={options}
        disabled={policies.isPending}
        {...form.register("escalationPolicyId")}
      />
    </FormSection>
  )
}
