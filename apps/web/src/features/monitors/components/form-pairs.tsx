import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { Button, Eyebrow, Input } from "@/components/ui"
import type { MonitorFormValues } from "../form-schema"

interface FormPairsProps {
  form: UseFormReturn<MonitorFormValues>
  name: "headers" | "metadata"
  label: string
  keyPlaceholder: string
  valuePlaceholder: string
}

export function FormPairs({ form, name, label, keyPlaceholder, valuePlaceholder }: FormPairsProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name })
  const keyField = name === "headers" ? "name" : "key"
  const errors = form.formState.errors[name]

  return (
    <div className="grid gap-2">
      <Eyebrow>{label}</Eyebrow>
      {fields.map((field, index) => {
        const error = (errors?.[index] as Record<string, { message?: string }> | undefined)?.[
          keyField
        ]?.message
        return (
          <div key={field.id} className="grid gap-1">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                aria-label={`${label} ${keyField} ${index + 1}`}
                placeholder={keyPlaceholder}
                aria-invalid={Boolean(error)}
                {...form.register(`${name}.${index}.${keyField}` as "headers.0.name")}
              />
              <Input
                aria-label={`${label} value ${index + 1}`}
                placeholder={valuePlaceholder}
                {...form.register(`${name}.${index}.value` as "headers.0.value")}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
          </div>
        )
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() =>
          append((name === "headers" ? { name: "", value: "" } : { key: "", value: "" }) as never)
        }
      >
        <Plus /> Add {name === "headers" ? "header" : "metadata"}
      </Button>
    </div>
  )
}
