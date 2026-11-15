import { Chip, Eyebrow } from "@/components/ui"

interface ChoiceChipsProps {
  label: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  help?: string
}

export function ChoiceChips({ label, options, value, onChange, help }: ChoiceChipsProps) {
  return (
    <div className="grid gap-2" role="group" aria-label={label}>
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      {help && <p className="text-[0.8125rem] text-muted-foreground">{help}</p>}
    </div>
  )
}
