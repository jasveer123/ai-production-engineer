"use client"

import { Chip, Input } from "@/components/ui"
import { STATUS_FILTERS } from "../constants"
import type { ErrorApp, ErrorFilters as Filters } from "../schemas"

interface ErrorFiltersProps {
  value: Filters
  apps: ErrorApp[]
  onChange: (next: Filters) => void
}

const ASSIGNEES = [
  ["all", "Anyone"],
  ["me", "Assigned to me"],
  ["none", "Unassigned"],
] as const

export function ErrorFilters({ value, apps, onChange }: ErrorFiltersProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Chip
              key={item.value}
              selected={value.status === item.value}
              onClick={() => set({ status: item.value })}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ASSIGNEES.map(([key, label]) => (
            <Chip
              key={key}
              selected={value.assignee === key}
              onClick={() => set({ assignee: key })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>
      {apps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={value.applicationId === ""} onClick={() => set({ applicationId: "" })}>
            All applications
          </Chip>
          {apps.map((app) => (
            <Chip
              key={app.id}
              selected={value.applicationId === app.id}
              onClick={() => set({ applicationId: app.id })}
            >
              {app.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search errors"
          className="w-64"
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search errors"
        />
        <Input
          aria-label="Environment"
          className="w-44"
          value={value.environment}
          onChange={(e) => set({ environment: e.target.value })}
          placeholder="Environment"
        />
        <Input
          aria-label="Release"
          className="w-44"
          value={value.release}
          onChange={(e) => set({ release: e.target.value })}
          placeholder="Release"
        />
      </div>
    </div>
  )
}
