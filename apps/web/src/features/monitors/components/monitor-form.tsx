"use client"

import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { HTTP_KINDS } from "../constants"
import { formDefaults, monitorFormSchema, toRequest, type MonitorFormValues } from "../form-schema"
import { useCreateMonitor, useUpdateMonitor } from "../hooks"
import type { Monitor } from "../schemas"
import { FormEscalationSection } from "./form-escalation-section"
import { FormMaintenanceSection } from "./form-maintenance-section"
import { FormPairs } from "./form-pairs"
import { FormRequestSection } from "./form-request-section"
import { FormSection } from "./form-section"
import { FormTargetSection } from "./form-target-section"
import { FormTimingSection } from "./form-timing-section"

interface MonitorFormProps {
  workspaceId: string
  monitor?: Monitor
}

export function MonitorForm({ workspaceId, monitor }: MonitorFormProps) {
  const router = useRouter()
  const create = useCreateMonitor(workspaceId)
  const update = useUpdateMonitor(workspaceId)
  const form = useForm<MonitorFormValues>({
    resolver: zodResolver(monitorFormSchema),
    defaultValues: formDefaults(monitor),
  })
  const http = HTTP_KINDS.includes(useWatch({ control: form.control, name: "kind" }))
  const pending = create.isPending || update.isPending

  const onSubmit = form.handleSubmit((values) => {
    const body = toRequest(values, Boolean(monitor))
    if (monitor) {
      update.mutate(
        { id: monitor.id, body },
        { onSuccess: () => router.push(ROUTES.monitorDetail(monitor.id)) }
      )
      return
    }
    create.mutate(body, { onSuccess: (created) => router.push(ROUTES.monitorDetail(created.id)) })
  })

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="grid gap-4">
      <FormTargetSection form={form} />
      <FormEscalationSection form={form} workspaceId={workspaceId} />
      <FormTimingSection form={form} />
      {http && (
        <FormRequestSection form={form} hasPassword={Boolean(monitor?.hasBasicAuthPassword)} />
      )}
      <FormMaintenanceSection form={form} />
      <FormSection
        title="Metadata"
        description="Key/value pairs added as labels to the incidents this monitor opens."
        collapsible
        defaultOpen={Boolean(monitor?.metadata.length)}
      >
        <FormPairs
          form={form}
          name="metadata"
          label="Metadata"
          keyPlaceholder="team"
          valuePlaceholder="payments"
        />
      </FormSection>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} {monitor ? "Save changes" : "Create monitor"}
        </Button>
      </div>
    </form>
  )
}
