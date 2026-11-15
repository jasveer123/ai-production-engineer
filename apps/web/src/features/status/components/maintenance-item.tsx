"use client"

import { X } from "lucide-react"
import { Badge, Button } from "@/components/ui"
import { PHASE_LABEL } from "../constants"
import type { Maintenance } from "../schemas"
import { formatInZone } from "../zoned-time"

interface MaintenanceItemProps {
  maintenance: Maintenance
  onRemove?: () => void
}

const PHASE_VARIANT = { upcoming: "info", in_progress: "warning", completed: "default" } as const

export function MaintenanceItem({ maintenance, onRemove }: MaintenanceItemProps) {
  return (
    <article
      className="grid gap-1.5 border border-line bg-panel p-4"
      aria-label={maintenance.title}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PHASE_VARIANT[maintenance.phase]}>{PHASE_LABEL[maintenance.phase]}</Badge>
        <h3 className="font-semibold">{maintenance.title}</h3>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="Remove maintenance"
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        {formatInZone(maintenance.startsAt, maintenance.timezone)} to{" "}
        {formatInZone(maintenance.endsAt, maintenance.timezone)} ({maintenance.timezone})
      </p>
      {maintenance.description && <p className="text-sm leading-6">{maintenance.description}</p>}
      {maintenance.affected.length > 0 && (
        <p className="text-[0.75rem] text-muted-foreground">
          Affects {maintenance.affected.map((a) => a.name).join(", ")}
        </p>
      )}
    </article>
  )
}
