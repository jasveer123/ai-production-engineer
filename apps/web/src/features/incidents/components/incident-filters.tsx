"use client"

import { Search } from "lucide-react"
import { Chip, Eyebrow, Input } from "@/components/ui"
import { SEVERITIES, STATE_FILTERS } from "../constants"
import type { IncidentListFilters } from "../response-schemas"
import { OptionSelect } from "./option-select"

interface IncidentFiltersProps {
  filters: IncidentListFilters
  monitors: Record<string, string>
  onChange: (patch: Partial<IncidentListFilters>) => void
}

export function IncidentFilters({ filters, monitors, onChange }: IncidentFiltersProps) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search incidents"
            placeholder="Search by name or cause"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            className="pl-9"
          />
        </div>
        <OptionSelect
          label="Monitor or source"
          value={filters.monitorId}
          options={monitors}
          anyLabel="All monitors"
          className="w-56"
          onChange={(monitorId) => onChange({ monitorId })}
        />
        <Input
          type="date"
          aria-label="Started from"
          value={filters.from}
          onChange={(event) => onChange({ from: event.target.value })}
          className="w-40"
        />
        <Input
          type="date"
          aria-label="Started until"
          value={filters.to}
          onChange={(event) => onChange({ to: event.target.value })}
          className="w-40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>State</Eyebrow>
          {STATE_FILTERS.map((item) => (
            <Chip
              key={item.value}
              selected={filters.state === item.value}
              onClick={() => onChange({ state: item.value })}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Severity</Eyebrow>
          <Chip selected={filters.severity === ""} onClick={() => onChange({ severity: "" })}>
            Any
          </Chip>
          {SEVERITIES.map((item) => (
            <Chip
              key={item}
              selected={filters.severity === item}
              onClick={() => onChange({ severity: item })}
            >
              {item}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
