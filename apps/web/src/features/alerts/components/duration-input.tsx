"use client"

import { Field, Input } from "@/components/ui"
import { SELECT_CLASS, TIME_UNITS } from "../constants"
import { splitSeconds } from "../lib"

interface DurationInputProps {
  id: string
  label: string
  seconds: number
  help?: string
  onChange: (seconds: number) => void
}

export function DurationInput({ id, label, seconds, help, onChange }: DurationInputProps) {
  const { amount, unit } = splitSeconds(seconds)
  return (
    <Field label={label} htmlFor={id} help={help}>
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          value={amount}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value)) * unit)}
        />
        <select
          aria-label={`${label} unit`}
          className={SELECT_CLASS}
          value={unit}
          onChange={(event) => onChange(amount * Number(event.target.value))}
        >
          {TIME_UNITS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}
