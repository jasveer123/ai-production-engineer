"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Chip, Eyebrow, Field, Input, Spinner, Switch, Textarea } from "@/components/ui"
import { maintenanceFormSchema, type MaintenanceFormValues } from "../forms"
import { useCreateMaintenance } from "../hooks"
import { zonedToIso } from "../zoned-time"

interface MaintenanceFormProps {
  workspaceId: string
  pageId: string
  resources: { id: string; publicName: string }[]
}

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

export function MaintenanceForm({ workspaceId, pageId, resources }: MaintenanceFormProps) {
  const create = useCreateMaintenance(workspaceId, pageId)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startsAt: "",
      endsAt: "",
      timezone: localZone(),
      resourceIds: [],
      notifySubscribers: true,
    },
  })

  const onSubmit = handleSubmit((v) =>
    create.mutate(
      {
        ...v,
        startsAt: zonedToIso(v.startsAt, v.timezone),
        endsAt: zonedToIso(v.endsAt, v.timezone),
      },
      { onSuccess: () => reset() }
    )
  )

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-4 border border-line bg-panel p-4">
      <Eyebrow>Schedule maintenance</Eyebrow>
      <Field label="Title" htmlFor="mt-title" error={errors.title?.message}>
        <Input
          id="mt-title"
          maxLength={120}
          placeholder="Database upgrade"
          {...register("title")}
        />
      </Field>
      <Field label="Description" htmlFor="mt-desc" error={errors.description?.message}>
        <Textarea id="mt-desc" rows={2} maxLength={2000} {...register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starts" htmlFor="mt-start" error={errors.startsAt?.message}>
          <Input id="mt-start" type="datetime-local" {...register("startsAt")} />
        </Field>
        <Field label="Ends" htmlFor="mt-end" error={errors.endsAt?.message}>
          <Input id="mt-end" type="datetime-local" {...register("endsAt")} />
        </Field>
        <Field label="Time zone" htmlFor="mt-tz" help="IANA name, e.g. Europe/Berlin">
          <Input id="mt-tz" {...register("timezone")} />
        </Field>
      </div>
      <Controller
        control={control}
        name="resourceIds"
        render={({ field }) => (
          <div className="grid gap-1.5" role="group" aria-label="Affected resources">
            <span className="text-[0.8125rem] font-medium">Affected resources</span>
            <div className="flex flex-wrap gap-2">
              {resources.map((r) => (
                <Chip
                  key={r.id}
                  selected={field.value.includes(r.id)}
                  onClick={() =>
                    field.onChange(
                      field.value.includes(r.id)
                        ? field.value.filter((id) => id !== r.id)
                        : [...field.value, r.id]
                    )
                  }
                >
                  {r.publicName}
                </Chip>
              ))}
              {resources.length === 0 && (
                <span className="text-[0.8125rem] text-muted-foreground">
                  Add resources under Structure first.
                </span>
              )}
            </div>
          </div>
        )}
      />
      <Controller
        control={control}
        name="notifySubscribers"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <Switch checked={field.value} onCheckedChange={field.onChange} />
            Email subscribers when scheduled and when it starts
          </label>
        )}
      />
      <Button type="submit" className="w-fit" disabled={create.isPending}>
        {create.isPending && <Spinner />} Schedule maintenance
      </Button>
    </form>
  )
}
