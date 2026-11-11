"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { Badge, Button, Switch } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { CONDITION_OPS } from "../constants"
import type { AlertRoute, AlertSource } from "../schemas"
import { RouteDialog } from "./route-dialog"

interface RouteRowProps {
  workspaceId: string
  route: AlertRoute
  index: number
  total: number
  sources: AlertSource[]
  canManage: boolean
  pending: boolean
  onToggle: (id: string, enabled: boolean) => void
  onMove: (index: number, direction: -1 | 1) => void
  onDelete: (id: string) => void
}

const opLabel = (op: string) => CONDITION_OPS.find((item) => item.value === op)?.label ?? op

export function RouteRow({
  workspaceId,
  route,
  index,
  total,
  sources,
  canManage,
  pending,
  onToggle,
  onMove,
  onDelete,
}: RouteRowProps) {
  const names = route.sourceIds.map(
    (id) => sources.find((s) => s.id === id)?.name ?? "removed source"
  )

  return (
    <li className="grid gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[0.75rem] text-muted-foreground">{index + 1}</span>
          <span className="font-medium">{route.name}</span>
          <Badge variant={route.createIncident ? "brand" : "default"}>
            {route.createIncident
              ? `Opens ${route.incidentSeverity ?? "an"} incident`
              : "Only records the alert"}
          </Badge>
          {!route.enabled && <Badge variant="warning">Off</Badge>}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              aria-label={route.enabled ? "Turn route off" : "Turn route on"}
              checked={route.enabled}
              disabled={pending}
              onCheckedChange={(checked) => onToggle(route.id, checked)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move up"
              disabled={pending || index === 0}
              onClick={() => onMove(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move down"
              disabled={pending || index === total - 1}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDown />
            </Button>
            <RouteDialog workspaceId={workspaceId} route={route} sources={sources} />
            <ConfirmDialog
              triggerLabel="Delete"
              title={`Delete ${route.name}?`}
              description="Alerts that matched this route will be handled by the next one."
              confirmLabel="Delete route"
              pending={pending}
              onConfirm={() => onDelete(route.id)}
            />
          </div>
        )}
      </div>
      <p className="text-[0.8125rem] leading-5 text-muted-foreground">
        {names.length ? `From ${names.join(", ")}` : "From every source"}
        {route.conditions.length > 0 &&
          `, when ${route.conditions
            .map((c) => `${c.field} ${opLabel(c.op)}${c.value ? ` "${c.value}"` : ""}`)
            .join(" and ")}`}
        {route.groupBy.length > 0 && `. Grouped by ${route.groupBy.join(", ")}`}
      </p>
    </li>
  )
}
