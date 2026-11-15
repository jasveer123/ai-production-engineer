import { Chip } from "@/components/ui"
import { HTTP_STATUSES } from "../constants"

interface StatusPickerProps {
  value: number[]
  onChange: (value: number[]) => void
  error?: string
}

export function StatusPicker({ value, onChange, error }: StatusPickerProps) {
  const toggle = (code: number) =>
    onChange(
      value.includes(code)
        ? value.filter((c) => c !== code)
        : [...value, code].sort((a, b) => a - b)
    )
  return (
    <div className="grid gap-2">
      <span className="text-[0.8125rem] font-medium">Expected status codes</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Expected status codes">
        {HTTP_STATUSES.map((code) => (
          <Chip key={code} selected={value.includes(code)} onClick={() => toggle(code)}>
            {code}
          </Chip>
        ))}
      </div>
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
    </div>
  )
}
