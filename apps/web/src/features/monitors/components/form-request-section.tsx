import { useWatch, type UseFormReturn } from "react-hook-form"
import { Field, Input, Textarea } from "@/components/ui"
import { HTTP_METHODS } from "../constants"
import type { MonitorFormValues } from "../form-schema"
import { FormPairs } from "./form-pairs"
import { FormSection } from "./form-section"
import { FormSelect } from "./form-select"
import { FormToggle } from "./form-toggle"

interface FormRequestSectionProps {
  form: UseFormReturn<MonitorFormValues>
  hasPassword: boolean
}

export function FormRequestSection({ form, hasPassword }: FormRequestSectionProps) {
  const { register, control, formState } = form
  const errors = formState.errors
  const method = useWatch({ control: form.control, name: "method" })

  return (
    <FormSection
      title="Request parameters"
      description="Method, body, headers, redirects and authentication."
      collapsible
    >
      <FormSelect
        id="monitor-method"
        label="HTTP method"
        error={errors.method?.message}
        options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
        {...register("method")}
      />
      {method !== "HEAD" && (
        <Field
          label="Request body"
          htmlFor="monitor-body"
          help="{timestamp} is replaced with the current Unix time."
          error={errors.body?.message}
        >
          <Textarea id="monitor-body" rows={4} className="font-mono" {...register("body")} />
        </Field>
      )}
      <FormPairs
        form={form}
        name="headers"
        label="Request headers"
        keyPlaceholder="X-Api-Key"
        valuePlaceholder="value"
      />
      <FormToggle control={control} name="followRedirects" label="Follow redirects" />
      <FormToggle control={control} name="keepCookies" label="Keep cookies when redirecting" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Basic auth username" htmlFor="monitor-auth-user">
          <Input id="monitor-auth-user" autoComplete="off" {...register("basicAuthUser")} />
        </Field>
        <Field
          label="Basic auth password"
          htmlFor="monitor-auth-password"
          help={hasPassword ? "Stored encrypted. Leave empty to keep it." : "Stored encrypted."}
        >
          <Input
            id="monitor-auth-password"
            type="password"
            autoComplete="new-password"
            placeholder={hasPassword ? "********" : ""}
            {...register("basicAuthPassword")}
          />
        </Field>
      </div>
    </FormSection>
  )
}
