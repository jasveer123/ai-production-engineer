"use client"

import { Badge, Button, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useCheckLogAlert, useDeleteLogAlert, useLogAlerts, usePauseLogAlert } from "../hooks"
import { LogAlertDialog } from "./log-alert-dialog"

interface LogAlertsPanelProps {
  workspaceId: string
  canManage: boolean
}

export function LogAlertsPanel({ workspaceId, canManage }: LogAlertsPanelProps) {
  const alerts = useLogAlerts(workspaceId)
  const pause = usePauseLogAlert(workspaceId)
  const remove = useDeleteLogAlert(workspaceId)
  const check = useCheckLogAlert(workspaceId)

  if (alerts.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  const items = alerts.data ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          Watch incoming logs. When enough match inside the time window, an alert opens and your
          routes decide what happens next.
        </p>
        {canManage && <LogAlertDialog workspaceId={workspaceId} />}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No log alerts yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant={item.state === "firing" ? "destructive" : "default"}>
                    {item.paused ? "paused" : item.state === "firing" ? "firing" : "ok"}
                  </Badge>
                  <Badge>{item.severity}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={check.isPending}
                    onClick={() => check.mutate(item.id)}
                  >
                    Check now
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={pause.isPending}
                        onClick={() => pause.mutate({ id: item.id, paused: !item.paused })}
                      >
                        {item.paused ? "Resume" : "Pause"}
                      </Button>
                      <ConfirmDialog
                        triggerLabel="Delete"
                        title={`Delete ${item.name}?`}
                        description="It stops watching logs. This cannot be undone."
                        confirmLabel="Delete alert"
                        pending={remove.isPending}
                        onConfirm={() => remove.mutate(item.id)}
                      />
                    </>
                  )}
                </div>
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">
                {item.threshold}+ {item.levels.join("/")} logs
                {item.service ? ` from ${item.service}` : ""}
                {item.contains ? ` containing "${item.contains}"` : ""} within {item.windowMinutes}{" "}
                min
                {item.lastCheckedAt
                  ? ` · ${item.lastCount ?? 0} seen, checked ${formatRelativeTime(item.lastCheckedAt)}`
                  : " · not checked yet"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
