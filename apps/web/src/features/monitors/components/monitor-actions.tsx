"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellRing, Pause, Pencil, Play, RotateCw } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { ROUTES } from "@/lib/constants/routes"
import { useCheckNow, useDeleteMonitor, useSendTestAlert, useUpdateMonitor } from "../hooks"
import type { MonitorDetail } from "../schemas"

interface MonitorActionsProps {
  workspaceId: string
  monitor: MonitorDetail
}

export function MonitorActions({ workspaceId, monitor }: MonitorActionsProps) {
  const router = useRouter()
  const update = useUpdateMonitor(workspaceId)
  const remove = useDeleteMonitor(workspaceId)
  const check = useCheckNow(workspaceId)
  const testAlert = useSendTestAlert(workspaceId)
  const busy = update.isPending || remove.isPending || check.isPending

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => check.mutate(monitor.id)}>
        {check.isPending ? <Spinner /> : <RotateCw />} Check now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={testAlert.isPending}
        onClick={() => testAlert.mutate(monitor.id)}
      >
        {testAlert.isPending ? <Spinner /> : <BellRing />} Send test alert
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => update.mutate({ id: monitor.id, body: { paused: !monitor.paused } })}
      >
        {monitor.paused ? <Play /> : <Pause />} {monitor.paused ? "Resume" : "Pause"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link href={`${ROUTES.monitorDetail(monitor.id)}/edit`} />}
      >
        <Pencil /> Edit
      </Button>
      <ConfirmDialog
        triggerLabel="Delete"
        title={`Delete ${monitor.name}?`}
        description="Checks stop and the monitor disappears from your workspace. This cannot be undone."
        confirmLabel="Delete monitor"
        pending={busy}
        onConfirm={() =>
          remove.mutate(monitor.id, { onSuccess: () => router.replace(ROUTES.monitors) })
        }
      />
    </div>
  )
}
