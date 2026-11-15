"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { cn } from "@/lib/utils"

const ANY = "__any"

interface OptionSelectProps {
  id?: string
  label: string
  value: string
  options: Record<string, string>
  anyLabel?: string
  className?: string
  onChange: (value: string) => void
}

export function OptionSelect({
  id,
  label,
  value,
  options,
  anyLabel,
  className,
  onChange,
}: OptionSelectProps) {
  const items = anyLabel ? { [ANY]: anyLabel, ...options } : options
  return (
    <Select
      value={value || (anyLabel ? ANY : null)}
      items={items}
      onValueChange={(next) => onChange(next === ANY || next == null ? "" : String(next))}
    >
      <SelectTrigger id={id} aria-label={label} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
