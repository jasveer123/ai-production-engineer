import * as React from "react"
import { Field } from "@/components/ui"
import { SELECT_CLASS } from "../constants"

interface FormSelectProps extends React.ComponentProps<"select"> {
  label: string
  id: string
  help?: string
  error?: string
  options: { value: string | number; label: string }[]
}

export function FormSelect({ label, id, help, error, options, ...props }: FormSelectProps) {
  return (
    <Field label={label} htmlFor={id} help={help} error={error}>
      <select id={id} className={SELECT_CLASS} aria-invalid={Boolean(error)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}
