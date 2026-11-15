"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Field,
  Input,
  Spinner,
  Switch,
} from "@/components/ui"
import { usePolicies } from "@/features/escalation"
import { ALERT_TYPES, MISSING_DATA, SEVERITIES } from "../constants"
import { useCreateMetricAlert } from "../hooks"
import { metricAlertFormSchema, type MetricAlertForm, type Widget } from "../schemas"
import { ChoiceChips } from "./choice-chips"

interface MetricAlertDrawerProps {
  workspaceId: string
  widget: Pick<Widget, "title" | "metric" | "agg" | "service" | "groupBy" | "filters">
}

const asNumber = { valueAsNumber: true } as const

export function MetricAlertDrawer({ workspaceId, widget }: MetricAlertDrawerProps) {
  const [open, setOpen] = React.useState(false)
  const create = useCreateMetricAlert(workspaceId)
  const policies = usePolicies(open ? workspaceId : undefined)
  const form = useForm<MetricAlertForm>({
    resolver: zodResolver(metricAlertFormSchema),
    defaultValues: {
      name: `${widget.title} alert`,
      type: "threshold",
      operator: "above",
      threshold: 0,
      windowMinutes: 5,
      everySeconds: 60,
      perSeries: Boolean(widget.groupBy),
      confirmationSeconds: 0,
      recoverySeconds: 0,
      missingData: "keep",
      severity: "high",
      escalationPolicyId: "",
    },
  })
  const { register, control, handleSubmit, formState } = form
  const errors = formState.errors
  const type = useWatch({ control, name: "type" })

  const onSubmit = handleSubmit(
    ({ type: kind, operator, threshold, escalationPolicyId, ...rest }) =>
      create
        .mutateAsync({
          ...rest,
          query: {
            metric: widget.metric,
            agg: widget.agg,
            ...(widget.service ? { service: widget.service } : {}),
            ...(widget.groupBy ? { groupBy: widget.groupBy } : {}),
            ...(widget.filters ? { filters: widget.filters } : {}),
          },
          condition: { type: kind, operator, threshold },
          escalationPolicyId: escalationPolicyId || null,
        })
        .then(
          () => setOpen(false),
          () => undefined
        )
  )

  const chips = (
    name: "type" | "operator" | "missingData" | "severity",
    label: string,
    options: readonly { value: string; label: string }[],
    help?: string
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceChips
          label={label}
          options={options}
          value={field.value}
          onChange={field.onChange}
          help={help}
        />
      )}
    />
  )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Alert on ${widget.title}`} />}
      >
        <Bell />
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
          <DrawerHeader>
            <DrawerTitle>Alert on this chart</DrawerTitle>
            <DrawerDescription>
              {widget.agg}({widget.metric}){widget.filters ? ` where ${widget.filters}` : ""}. Opens
              an incident through your alert routes.
            </DrawerDescription>
          </DrawerHeader>
          <Field label="Name" htmlFor="alert-name" error={errors.name?.message}>
            <Input id="alert-name" maxLength={80} {...register("name")} />
          </Field>
          {chips(
            "type",
            "Alert when",
            ALERT_TYPES,
            ALERT_TYPES.find((t) => t.value === type)?.help
          )}
          {chips("operator", "Direction", [
            { value: "above", label: type === "threshold" ? "Above" : "Rises" },
            { value: "below", label: type === "threshold" ? "Below" : "Falls" },
          ])}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={
                type === "threshold"
                  ? "Threshold"
                  : type === "relative"
                    ? "Change %"
                    : "Standard deviations"
              }
              htmlFor="alert-threshold"
              error={errors.threshold?.message}
            >
              <Input
                id="alert-threshold"
                type="number"
                step="any"
                {...register("threshold", asNumber)}
              />
            </Field>
            <Field
              label="Window (minutes)"
              htmlFor="alert-window"
              error={errors.windowMinutes?.message}
            >
              <Input id="alert-window" type="number" {...register("windowMinutes", asNumber)} />
            </Field>
            <Field
              label="Check every (seconds)"
              htmlFor="alert-every"
              error={errors.everySeconds?.message}
            >
              <Input id="alert-every" type="number" {...register("everySeconds", asNumber)} />
            </Field>
            <Field
              label="Confirmation (seconds)"
              htmlFor="alert-confirm"
              error={errors.confirmationSeconds?.message}
            >
              <Input
                id="alert-confirm"
                type="number"
                {...register("confirmationSeconds", asNumber)}
              />
            </Field>
            <Field
              label="Recovery (seconds)"
              htmlFor="alert-recover"
              error={errors.recoverySeconds?.message}
            >
              <Input id="alert-recover" type="number" {...register("recoverySeconds", asNumber)} />
            </Field>
          </div>
          {widget.groupBy && (
            <Controller
              control={control}
              name="perSeries"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span className="grid gap-0.5">
                    <span className="text-[0.8125rem] font-medium">
                      One incident per {widget.groupBy}
                    </span>
                    <span className="text-[0.8125rem] text-muted-foreground">
                      Off evaluates the whole query as one series.
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          )}
          {chips("missingData", "When there is no data", MISSING_DATA)}
          {chips(
            "severity",
            "Severity",
            SEVERITIES.map((s) => ({ value: s, label: s }))
          )}
          <Controller
            control={control}
            name="escalationPolicyId"
            render={({ field }) => (
              <ChoiceChips
                label="Escalation policy"
                options={[
                  { value: "", label: "Workspace default" },
                  ...(policies.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <DrawerFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />} Create alert
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
