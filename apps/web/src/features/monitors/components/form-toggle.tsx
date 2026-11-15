import { Controller, type Control } from "react-hook-form"
import { Switch } from "@/components/ui"
import type { MonitorFormValues } from "../form-schema"

type BooleanField = "followRedirects" | "keepCookies" | "verifyTls" | "maintenanceEnabled"

interface FormToggleProps {
  control: Control<MonitorFormValues>
  name: BooleanField
  label: string
  help?: string
}

export function FormToggle({ control, name, label, help }: FormToggleProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span className="grid gap-0.5">
            <span className="text-[0.8125rem] font-medium">{label}</span>
            {help && <span className="text-[0.8125rem] text-muted-foreground">{help}</span>}
          </span>
          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  )
}
