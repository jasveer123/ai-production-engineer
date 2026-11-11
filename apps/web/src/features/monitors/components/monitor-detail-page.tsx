"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pause, Play, RotateCw } from "lucide-react"
import {
  Badge,
  Button,
  Eyebrow,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime, formatRelativeTime } from "@/lib/format/relative-time"
import { KIND_LABEL, STATE_LABEL, STATE_VARIANT } from "../constants"
import { useCheckNow, useDeleteMonitor, useMonitor, useUpdateMonitor } from "../hooks"
import { MonitorCreateDialog } from "./monitor-create-dialog"
import { MonitorTarget } from "./monitor-target"
import { ResponseChart } from "./response-chart"

export function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const monitor = useMonitor(workspace?.id, id)
  const update = useUpdateMonitor(workspace?.id ?? "")
  const remove = useDeleteMonitor(workspace?.id ?? "")
  const check = useCheckNow(workspace?.id ?? "")

  if (isPending || (workspace && monitor.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  if (!monitor.data) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        This monitor was not found in your workspace.
      </p>
    )
  }

  const data = monitor.data
  const busy = update.isPending || remove.isPending || check.isPending

  return (
    <div className="grid min-w-0 gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={ROUTES.monitors} />}
      >
        <ArrowLeft /> All monitors
      </Button>
      <header className="grid gap-4 border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {data.paused ? (
                <Badge variant="warning">Paused</Badge>
              ) : (
                <Badge
                  variant={STATE_VARIANT[data.state as keyof typeof STATE_VARIANT] ?? "default"}
                >
                  {STATE_LABEL[data.state] ?? data.state}
                </Badge>
              )}
              <Badge>{KIND_LABEL[data.kind] ?? data.kind}</Badge>
              <span className="text-[0.8125rem] text-muted-foreground">
                since {formatRelativeTime(data.stateSince)}
              </span>
            </div>
            <h1 className="font-heading text-[1.5rem] leading-8 font-semibold tracking-tight">
              {data.name}
            </h1>
            <p className="font-mono text-[0.8125rem] break-all text-muted-foreground">
              <MonitorTarget monitor={data} />
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => check.mutate(data.id)}
              >
                {check.isPending ? <Spinner /> : <RotateCw />} Check now
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => update.mutate({ id: data.id, body: { paused: !data.paused } })}
              >
                {data.paused ? <Play /> : <Pause />} {data.paused ? "Resume" : "Pause"}
              </Button>
              <MonitorCreateDialog workspaceId={workspace.id} monitor={data} />
              <ConfirmDialog
                triggerLabel="Delete"
                title={`Delete ${data.name}?`}
                description="Checks stop and the history is removed. This cannot be undone."
                confirmLabel="Delete monitor"
                pending={busy}
                onConfirm={() =>
                  remove.mutate(data.id, { onSuccess: () => router.replace(ROUTES.monitors) })
                }
              />
            </div>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-4">
          {[
            [
              "Uptime, 24h",
              data.uptime24h === null
                ? "-"
                : `${data.uptime24h.toFixed(data.uptime24h === 100 ? 0 : 2)}%`,
            ],
            ["Last response", data.lastResponseMs === null ? "-" : `${data.lastResponseMs} ms`],
            [
              "Checks every",
              data.intervalSeconds >= 60
                ? `${Math.round(data.intervalSeconds / 60)} min`
                : `${data.intervalSeconds} s`,
            ],
            [
              "Alerts after",
              `${data.confirmations} failed ${data.confirmations === 1 ? "check" : "checks"}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <dt className="font-mono text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
                {label}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        {data.lastError && <p className="text-sm text-danger">Last error: {data.lastError}</p>}
      </header>
      <section className="grid gap-3 border border-line bg-panel p-5">
        <Eyebrow>Response time, last 24 hours</Eyebrow>
        <ResponseChart buckets={data.history} />
      </section>
      <section className="grid gap-3">
        <Eyebrow>Recent checks</Eyebrow>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check has run yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-[0.75rem] text-muted-foreground">
                    {formatDateTime(item.checkedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.ok ? "success" : "destructive"}>
                      {item.ok ? "Passed" : "Failed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {item.statusCode ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {item.responseMs} ms
                  </TableCell>
                  <TableCell className="text-danger">{item.error ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
