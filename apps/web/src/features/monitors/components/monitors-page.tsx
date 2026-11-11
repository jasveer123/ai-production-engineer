"use client"

import { StatusStrip, StorySteps } from "@/components/shared"
import { Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui"
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
  const active = items.filter((item) => !item.paused)
  const down = active.filter((item) => item.state === "down")
  const up = active.filter((item) => item.state === "up")
  const uptimes = active.flatMap((item) => (item.uptime24h === null ? [] : [item.uptime24h]))
  const average = uptimes.length ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length : null
  const slowest = [...active].sort((a, b) => (b.lastResponseMs ?? 0) - (a.lastResponseMs ?? 0))[0]
  const create = canManage ? <MonitorCreateDialog workspaceId={workspace.id} /> : null

  const headline =
    items.length === 0
      ? "Nothing is watching your site yet"
      : down.length > 0
        ? down.length === 1
          ? `${down[0]!.name} is down`
          : `${down.length} monitors are down`
        : active.length === 0
          ? "All monitors are paused"
          : "Everything is answering"

  const detail =
    items.length === 0
      ? "Add a monitor and Pramaan checks your site from outside, so you know before your users do."
      : down.length > 0
        ? "An alert is raised and your escalation policy is paging the person on call."
        : "Every check passed on its last run. Pramaan alerts you the moment that changes."

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Monitors" />
      {items.length === 0 ? (
        <>
          <StatusStrip tone="idle" headline={headline} detail={detail} action={create} />
          <StorySteps
            heading="How a monitor protects you"
            steps={[
              {
                title: "You add an address",
                text: "A website, a keyword on a page, a status code or an open port.",
              },
              {
                title: "We check it all day",
                text: "From outside your network, as often as every 30 seconds.",
              },
              {
                title: "You hear first",
                text: "Failures raise an alert, page on-call and update your status page.",
              },
            ]}
          />
        </>
      ) : (
        <>
          <StatusStrip
            tone={down.length > 0 ? "bad" : active.length === 0 ? "warn" : "ok"}
            headline={headline}
            detail={detail}
            action={create}
            stats={[
              { label: "Up", value: `${up.length} of ${items.length}` },
              {
                label: "Avg uptime, 24h",
                value: average === null ? "-" : `${average.toFixed(2)}%`,
              },
              {
                label: "Slowest",
                value: slowest?.lastResponseMs ? `${slowest.lastResponseMs} ms` : "-",
              },
              { label: "Paused", value: items.length - active.length },
            ]}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monitor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uptime, 24h</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Checks</TableHead>
                <TableHead>Last check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((monitor) => (
                <MonitorRow key={monitor.id} monitor={monitor} />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
