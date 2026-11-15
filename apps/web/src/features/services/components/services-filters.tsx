"use client"

import { Search } from "lucide-react"
import { Chip, Eyebrow, Input } from "@/components/ui"
import { STATUS_FILTERS, STATUS_FILTER_LABEL, type StatusFilter } from "../constants"

interface ServicesFiltersProps {
  search: string
  status: StatusFilter
  environment: string
  environments: string[]
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onEnvironmentChange: (value: string) => void
}

export function ServicesFilters({
  search,
  status,
  environment,
  environments,
  onSearchChange,
  onStatusChange,
  onEnvironmentChange,
}: ServicesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search services"
          placeholder="Search services"
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
      {environments.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Environment</Eyebrow>
          <Chip selected={environment === ""} onClick={() => onEnvironmentChange("")}>
            All
          </Chip>
          {environments.map((item) => (
            <Chip
              key={item}
              selected={environment === item}
              onClick={() => onEnvironmentChange(item)}
            >
              {item}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
