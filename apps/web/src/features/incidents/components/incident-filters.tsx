"use client"

import { Search } from "lucide-react"
import { Chip, Eyebrow, Input } from "@/components/ui"
import { SEVERITIES, STATUS_FILTERS, STATUS_FILTER_LABEL, type StatusFilter } from "../constants"

interface IncidentFiltersProps {
  search: string
  status: StatusFilter
  severity: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onSeverityChange: (value: string) => void
}

export function IncidentFilters({
  search,
  status,
  severity,
  onSearchChange,
  onStatusChange,
  onSeverityChange,
}: IncidentFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search incidents"
          placeholder="Search incidents or services"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Status</Eyebrow>
        {STATUS_FILTERS.map((item) => (
          <Chip key={item} selected={status === item} onClick={() => onStatusChange(item)}>
            {STATUS_FILTER_LABEL[item]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Severity</Eyebrow>
        <Chip selected={severity === ""} onClick={() => onSeverityChange("")}>
          Any
        </Chip>
        {SEVERITIES.map((item) => (
          <Chip key={item} selected={severity === item} onClick={() => onSeverityChange(item)}>
            {item}
          </Chip>
        ))}
      </div>
    </div>
  )
}
