import { Controller, type UseFormReturn, useWatch } from "react-hook-form"
import { Chip, Eyebrow, Field, Input } from "@/components/ui"
import {
  CONFIRMATION_PERIODS,
  EXPIRY_ALERTS,
  HTTP_KINDS,
  INTERVALS,
  IP_VERSIONS,
  RECOVERY_PERIODS,
  REGIONS,
  TIMEOUTS,
} from "../constants"
import type { MonitorFormValues } from "../form-schema"
import { FormSection } from "./form-section"
import { FormSelect } from "./form-select"
import { FormToggle } from "./form-toggle"

interface FormTimingSectionProps {
  form: UseFormReturn<MonitorFormValues>
}

const asNumber = { valueAsNumber: true } as const

export function FormTimingSection({ form }: FormTimingSectionProps) {
  const { register, control, formState } = form
  const errors = formState.errors
  const http = HTTP_KINDS.includes(useWatch({ control: form.control, name: "kind" }))

  return (
    <FormSection
      title="Advanced settings"
      description="Timing, verification, expiry alerts and regions."
      collapsible
      defaultOpen
    >
      <Field
        label="Pronounceable name"
        htmlFor="monitor-pronounceable"
        help="Used when a phone call reads out the incident."
      >
        <Input
          id="monitor-pronounceable"
          placeholder="Shop home page"
          {...register("pronounceableName")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          id="monitor-interval"
          label="Check frequency"
          options={INTERVALS.map((i) => ({ value: i.seconds, label: i.label }))}
          {...register("intervalSeconds", asNumber)}
        />
        <FormSelect
          id="monitor-timeout"
          label="Request timeout"
          options={TIMEOUTS.map((s) => ({
            value: s,
            label: s < 60 ? `${s} seconds` : `${s / 60} min`,
          }))}
          {...register("timeoutSeconds", asNumber)}
        />
        <FormSelect
          id="monitor-confirmation"
          label="Confirmation period"
          help="How long to keep failing before we open an incident."
          options={CONFIRMATION_PERIODS.map((i) => ({ value: i.seconds, label: i.label }))}
          {...register("confirmationSeconds", asNumber)}
        />
        <FormSelect
          id="monitor-recovery"
          label="Recovery period"
          help="How long to stay up before we resolve it."
          options={RECOVERY_PERIODS.map((i) => ({ value: i.seconds, label: i.label }))}
          {...register("recoverySeconds", asNumber)}
        />
        <FormSelect
          id="monitor-ip"
          label="IP version"
          options={IP_VERSIONS}
          {...register("ipVersion")}
        />
        {http && (
          <FormSelect
            id="monitor-ssl-expiry"
            label="SSL certificate expiration"
            error={errors.sslExpiryDays?.message}
            options={EXPIRY_ALERTS.map((e) => ({ value: e.days, label: e.label }))}
            {...register("sslExpiryDays", asNumber)}
          />
        )}
        <FormSelect
          id="monitor-domain-expiry"
          label="Domain expiration"
          help="Looked up through RDAP twice a day."
          options={EXPIRY_ALERTS.map((e) => ({ value: e.days, label: e.label }))}
          {...register("domainExpiryDays", asNumber)}
        />
      </div>
      <FormToggle
        control={control}
        name="verifyTls"
        label="Verify SSL/TLS certificates"
        help="Turn off to accept self-signed or expired certificates."
      />
      <Controller
        control={control}
        name="regions"
        render={({ field }) => (
          <div className="grid gap-2">
            <Eyebrow>Regions</Eyebrow>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Regions">
              {REGIONS.map((region) => (
                <Chip
                  key={region.value}
                  selected={field.value.includes(region.value)}
                  onClick={() =>
                    field.onChange(
                      field.value.includes(region.value)
                        ? field.value.filter((r) => r !== region.value)
                        : [...field.value, region.value]
                    )
                  }
                >
                  {region.label}
                </Chip>
              ))}
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              Saved with the monitor. Checks currently run from this server only; each check shows
              where it ran.
            </p>
            {errors.regions && (
              <p className="text-[0.8125rem] text-danger">{errors.regions.message}</p>
            )}
          </div>
        )}
      />
    </FormSection>
  )
}
