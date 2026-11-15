"use client"

import { Chip, Input } from "@/components/ui"
import type { SessionFilters as Filters } from "../schemas"

interface SessionFiltersProps {
  value: Filters
  onChange: (next: Filters) => void
}

const DEVICES = ["", "desktop", "mobile", "tablet"]
const DURATIONS = [
  [0, "Any length"],
  [30, "30s+"],
  [300, "5m+"],
] as const

export function SessionFilters({ value, onChange }: SessionFiltersProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={value.hasErrors} onClick={() => set({ hasErrors: !value.hasErrors })}>
          Only sessions with errors
        </Chip>
        {DEVICES.map((device) => (
          <Chip key={device} selected={value.device === device} onClick={() => set({ device })}>
            {device || "Any device"}
          </Chip>
        ))}
        {DURATIONS.map(([seconds, label]) => (
          <Chip
            key={seconds}
            selected={value.minSeconds === seconds}
            onClick={() => set({ minSeconds: seconds })}
          >
            {label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search sessions"
          className="w-64"
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search by user or page"
        />
        <Input
          aria-label="Browser"
          className="w-40"
          value={value.browser}
          onChange={(e) => set({ browser: e.target.value })}
          placeholder="Browser, e.g. Chrome"
        />
        <Input
          aria-label="Country code"
          className="w-32"
          maxLength={2}
          value={value.country}
          onChange={(e) => set({ country: e.target.value.toUpperCase() })}
          placeholder="Country (US)"
        />
      </div>
    </div>
  )
}
