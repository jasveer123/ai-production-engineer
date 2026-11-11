"use client"

import {
  Eyebrow,
  Spinner,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { useMonitors } from "../hooks"
import { MonitorCreateDialog } from "./monitor-create-dialog"
import { MonitorRow } from "./monitor-row"

export function MonitorsPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const monitors = useMonitors(workspace?.id)

  if (isPending || (workspace && monitors.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = monitors.data ?? []
  const down = items.filter((item) => !item.paused && item.state === "down")
  const kpis = [
    { label: "Monitors", value: items.length, note: "checking for you", hot: false },
    {
      label: "Up",
      value: items.filter((i) => !i.paused && i.state === "up").length,
      note: "answering normally",
      hot: false,
    },
    {
      label: "Down",
      value: down.length,
      note: down.length ? down.map((i) => i.name).join(", ") : "none",
      hot: down.length > 0,
    },
    {
      label: "Paused",
      value: items.filter((i) => i.paused).length,
      note: "not checking",
      hot: false,
    },
  ]

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Monitors" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="grid content-start gap-1 border border-line bg-panel p-4"
          >
            <Eyebrow>{item.label}</Eyebrow>
            <span
              className={`font-heading text-2xl font-semibold ${item.hot ? "text-danger" : ""}`}
            >
              {item.value}
            </span>
            <span className="truncate text-[0.75rem] text-muted-foreground" title={item.note}>
              {item.note}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          A monitor checks a website or a port on a schedule. When it fails, Pramaan raises an
          alert, and a route can turn that into an incident.
        </p>
        {canManage && <MonitorCreateDialog workspaceId={workspace.id} />}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No monitors yet. Add one to know when your site goes down.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Monitor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead>Uptime, 24h</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Last check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((monitor) => (
              <MonitorRow key={monitor.id} monitor={monitor} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
