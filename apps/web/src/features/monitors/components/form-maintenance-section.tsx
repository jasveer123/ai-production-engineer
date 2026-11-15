import { Controller, type UseFormReturn, useWatch } from "react-hook-form"
import { Chip, Field, Input } from "@/components/ui"
import { WEEKDAYS } from "../constants"
import type { MonitorFormValues } from "../form-schema"
import { FormSection } from "./form-section"
import { FormToggle } from "./form-toggle"

interface FormMaintenanceSectionProps {
  form: UseFormReturn<MonitorFormValues>
}

export function FormMaintenanceSection({ form }: FormMaintenanceSectionProps) {
  const { register, control, formState } = form
  const errors = formState.errors
  const enabled = useWatch({ control: form.control, name: "maintenanceEnabled" })

  return (
    <FormSection
      title="Maintenance window"
      description="A daily window when failures are recorded but never open an incident."
      collapsible
      defaultOpen={enabled}
    >
      <FormToggle control={control} name="maintenanceEnabled" label="Daily maintenance window" />
      {enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="From" htmlFor="monitor-mw-from">
              <Input id="monitor-mw-from" type="time" {...register("maintenanceFrom")} />
            </Field>
            <Field label="To" htmlFor="monitor-mw-to" error={errors.maintenanceTo?.message}>
              <Input id="monitor-mw-to" type="time" {...register("maintenanceTo")} />
            </Field>
            <Field label="Time zone" htmlFor="monitor-mw-tz">
              <Input
                id="monitor-mw-tz"
                placeholder="Europe/London"
                {...register("maintenanceTimezone")}
              />
            </Field>
          </div>
          <Controller
            control={control}
            name="maintenanceWeekdays"
            render={({ field }) => (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
                  {WEEKDAYS.map((day, index) => (
                    <Chip
                      key={day}
                      selected={field.value.includes(index)}
                      onClick={() =>
                        field.onChange(
                          field.value.includes(index)
                            ? field.value.filter((d) => d !== index)
                            : [...field.value, index].sort((a, b) => a - b)
                        )
                      }
                    >
                      {day}
                    </Chip>
                  ))}
                </div>
                {errors.maintenanceWeekdays && (
                  <p className="text-[0.8125rem] text-danger">
                    {errors.maintenanceWeekdays.message}
                  </p>
                )}
              </div>
            )}
          />
        </>
      )}
    </FormSection>
  )
}
