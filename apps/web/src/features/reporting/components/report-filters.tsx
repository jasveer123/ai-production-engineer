"use client"

import { Chip, Input } from "@/components/ui"
import { OptionSelect } from "@/features/incidents"
import type { ReportFilters as Filters } from "../schemas"

interface ReportFiltersProps {
  filters: Filters
  monitors: Record<string, string>
  policies: Record<string, string>
  people: Record<string, string>
  onChange: (patch: Partial<Filters>) => void
}

export function ReportFilters({
  filters,
  monitors,
  policies,
  people,
  onChange,
}: ReportFiltersProps) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          aria-label="From"
          value={filters.from}
          onChange={(e) => e.target.value && onChange({ from: e.target.value })}
          className="w-40"
        />
        <Input
          type="date"
          aria-label="To"
          value={filters.to}
          onChange={(e) => e.target.value && onChange({ to: e.target.value })}
          className="w-40"
        />
        <OptionSelect
          label="Monitor"
          value={filters.monitorId}
          options={monitors}
          anyLabel="All monitors"
          className="w-52"
          onChange={(monitorId) => onChange({ monitorId })}
        />
        <OptionSelect
          label="Escalation policy"
          value={filters.policyId}
          options={policies}
          anyLabel="All policies"
          className="w-52"
          onChange={(policyId) => onChange({ policyId })}
        />
        <OptionSelect
          label="Acknowledged by"
          value={filters.acknowledgedBy}
          options={people}
          anyLabel="Acknowledged by anyone"
          className="w-56"
          onChange={(acknowledgedBy) => onChange({ acknowledgedBy })}
        />
        <OptionSelect
          label="Resolved by"
          value={filters.resolvedBy}
          options={people}
          anyLabel="Resolved by anyone"
          className="w-56"
          onChange={(resolvedBy) => onChange({ resolvedBy })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={filters.businessHours}
          onClick={() => onChange({ businessHours: !filters.businessHours })}
        >
          Business hours only (09:00-17:00)
        </Chip>
        <Chip selected={filters.weekdays} onClick={() => onChange({ weekdays: !filters.weekdays })}>
          Weekdays only
        </Chip>
      </div>
    </div>
  )
}
