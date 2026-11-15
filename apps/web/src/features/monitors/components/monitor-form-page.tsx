"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { useMonitor } from "../hooks"
import { MonitorForm } from "./monitor-form"

export function MonitorFormPage() {
  const params = useParams<{ id?: string }>()
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const monitor = useMonitor(params.id ? workspace?.id : undefined, params.id ?? "")
  const loading = isPending || (params.id && workspace && monitor.isPending)

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null
  if (!canManage || (params.id && !monitor.data)) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        {canManage
          ? "This monitor was not found in your workspace."
          : "Only workspace admins can create or edit monitors."}
      </p>
    )
  }

  const back = params.id ? ROUTES.monitorDetail(params.id) : ROUTES.monitors
  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={back} />}
      >
        <ArrowLeft /> {params.id ? "Back to monitor" : "All monitors"}
      </Button>
      <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
        {monitor.data ? `Edit ${monitor.data.name}` : "Create monitor"}
      </h1>
      <MonitorForm workspaceId={workspace.id} monitor={monitor.data} />
    </div>
  )
}
