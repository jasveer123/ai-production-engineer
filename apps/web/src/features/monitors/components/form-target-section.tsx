import { Controller, type UseFormReturn, useWatch } from "react-hook-form"
import { Field, Input, Textarea } from "@/components/ui"
import { ALERT_WHEN, DNS_RECORD_TYPES, HTTP_KINDS, MAIL_PORTS } from "../constants"
import type { MonitorFormValues } from "../form-schema"
import { FormSection } from "./form-section"
import { FormSelect } from "./form-select"
import { StatusPicker } from "./status-picker"

interface FormTargetSectionProps {
  form: UseFormReturn<MonitorFormValues>
}

export function FormTargetSection({ form }: FormTargetSectionProps) {
  const { register, setValue, formState } = form
  const errors = formState.errors
  const kind = useWatch({ control: form.control, name: "kind" })
  const mode = useWatch({ control: form.control, name: "keywordMode" })
  const http = HTTP_KINDS.includes(kind)
  const alertWhen = kind === "keyword" ? `keyword:${mode}` : kind

  const onAlertWhen = (value: string) => {
    const option = ALERT_WHEN.find((item) => item.value === value)
    if (!option) return
    setValue("kind", option.kind, { shouldValidate: formState.isSubmitted })
    if (option.kind === "keyword") setValue("keywordMode", value.split(":")[1] ?? "present")
  }

  return (
    <FormSection
      title="What to monitor"
      description="Pick what counts as down, and where we should look."
    >
      <FormSelect
        id="monitor-alert-when"
        label="Alert us when"
        value={alertWhen}
        onChange={(e) => onAlertWhen(e.target.value)}
        options={ALERT_WHEN.map((item) => ({ value: item.value, label: item.label }))}
      />
      {http ? (
        <Field label="URL to monitor" htmlFor="monitor-url" error={errors.url?.message}>
          <Input
            id="monitor-url"
            placeholder="https://example.com"
            aria-invalid={Boolean(errors.url)}
            {...register("url")}
          />
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field
            label={kind === "dns" ? "DNS server (IP address)" : "Host"}
            htmlFor="monitor-host"
            error={errors.host?.message}
          >
            <Input
              id="monitor-host"
              placeholder={kind === "dns" ? "1.1.1.1" : "db.example.com"}
              aria-invalid={Boolean(errors.host)}
              {...register("host")}
            />
          </Field>
          {kind !== "ping" && (
            <Field label="Port" htmlFor="monitor-port" error={errors.port?.message}>
              <Input
                id="monitor-port"
                inputMode="numeric"
                placeholder={MAIL_PORTS[kind] ? String(MAIL_PORTS[kind]) : "5432"}
                aria-invalid={Boolean(errors.port)}
                {...register("port")}
              />
            </Field>
          )}
        </div>
      )}
      {(kind === "keyword" || kind === "udp") && (
        <Field
          label={kind === "udp" ? "Expected text in the reply (optional)" : "Keyword"}
          htmlFor="monitor-keyword"
          help={
            kind === "keyword"
              ? mode === "absent"
                ? "We alert when this text appears on the page."
                : "We alert when this text is missing from the page."
              : undefined
          }
          error={errors.keyword?.message}
        >
          <Input id="monitor-keyword" {...register("keyword")} />
        </Field>
      )}
      {kind === "udp" && (
        <Field label="Packet to send" htmlFor="monitor-udp" help="Sent as UTF-8 text.">
          <Textarea id="monitor-udp" rows={2} {...register("udpPayload")} />
        </Field>
      )}
      {kind === "status" && (
        <Controller
          control={form.control}
          name="expectedStatuses"
          render={({ field }) => (
            <StatusPicker
              value={field.value}
              onChange={field.onChange}
              error={errors.expectedStatuses?.message}
            />
          )}
        />
      )}
      {kind === "dns" && (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field
            label="Domain to resolve"
            htmlFor="monitor-dns-domain"
            error={errors.dnsDomain?.message}
          >
            <Input id="monitor-dns-domain" placeholder="example.com" {...register("dnsDomain")} />
          </Field>
          <FormSelect
            id="monitor-dns-type"
            label="Record"
            options={DNS_RECORD_TYPES.map((t) => ({ value: t, label: t }))}
            {...register("dnsRecordType")}
          />
          <Field
            label="Expected answer (optional)"
            htmlFor="monitor-dns-expected"
            help="We alert when no answer contains this text."
            className="sm:col-span-2"
          >
            <Input
              id="monitor-dns-expected"
              placeholder="93.184.215.14"
              {...register("dnsExpected")}
            />
          </Field>
        </div>
      )}
      <Field label="Name" htmlFor="monitor-name" error={errors.name?.message}>
        <Input
          id="monitor-name"
          maxLength={80}
          placeholder="Shop home page"
          {...register("name")}
        />
      </Field>
    </FormSection>
  )
}
