"use client"

import { Spinner } from "@/components/ui"
import {
  useAlertRoutes,
  useAlertSources,
  useDeleteRoute,
  useReorderRoutes,
  useToggleRoute,
} from "../hooks"
import { RouteDialog } from "./route-dialog"
import { RouteRow } from "./route-row"

interface RoutesPanelProps {
  workspaceId: string
  canManage: boolean
}

export function RoutesPanel({ workspaceId, canManage }: RoutesPanelProps) {
  const routes = useAlertRoutes(workspaceId)
  const sources = useAlertSources(workspaceId)
  const toggle = useToggleRoute(workspaceId)
  const remove = useDeleteRoute(workspaceId)
  const reorder = useReorderRoutes(workspaceId)
  const pending = toggle.isPending || remove.isPending || reorder.isPending
  const items = routes.data ?? []
  const sourceList = sources.data ?? []

  const move = (index: number, direction: -1 | 1) => {
    const ids = items.map((route) => route.id)
    const target = index + direction
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorder.mutate(ids)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          A route decides what happens to an alert: open an incident, group it with others, or only
          record it. The first matching route wins.
        </p>
        {canManage && <RouteDialog workspaceId={workspaceId} route={null} sources={sourceList} />}
      </div>
      {routes.isPending ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No routes yet. Without one, an alert is only recorded.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((route, index) => (
            <RouteRow
              key={route.id}
              workspaceId={workspaceId}
              route={route}
              index={index}
              total={items.length}
              sources={sourceList}
              canManage={canManage}
              pending={pending}
              onToggle={(id, enabled) => toggle.mutate({ id, enabled })}
              onMove={move}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
