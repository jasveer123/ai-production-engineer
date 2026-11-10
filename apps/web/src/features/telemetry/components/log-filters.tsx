"use client"

import { ChevronDown, Search } from "lucide-react"
import {
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Eyebrow,
  Input,
} from "@/components/ui"
import { LOG_LEVEL_FILTERS, QUERY_HINT } from "../constants"
import type { LogFilters as Filters } from "../schemas"

interface LogFiltersProps {
  value: Filters
  services: string[]
  onChange: (value: Filters) => void
}

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]

export function LogFilters({ value, services, onChange }: LogFiltersProps) {
  return (
    <div className="grid gap-3 border border-line bg-panel p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search logs"
          placeholder="Search logs"
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          className="pl-9 font-mono"
        />
      </div>
      <p className="font-mono text-[0.6875rem] text-muted-foreground">{QUERY_HINT}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Level</Eyebrow>
          {LOG_LEVEL_FILTERS.map((level) => (
            <Chip
              key={level}
              selected={value.levels.includes(level)}
              onClick={() => onChange({ ...value, levels: toggle(value.levels, level) })}
            >
              {level}
            </Chip>
          ))}
        </div>
        {services.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Service</Eyebrow>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                {value.services.length === 0
                  ? "All services"
                  : value.services.length === 1
                    ? value.services[0]
                    : `${value.services.length} services`}
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-72 min-w-56 overflow-y-auto">
                {services.map((service) => (
                  <DropdownMenuCheckboxItem
                    key={service}
                    checked={value.services.includes(service)}
                    onCheckedChange={() =>
                      onChange({ ...value, services: toggle(value.services, service) })
                    }
                  >
                    {service}
                  </DropdownMenuCheckboxItem>
                ))}
                {value.services.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onChange({ ...value, services: [] })}>
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}
