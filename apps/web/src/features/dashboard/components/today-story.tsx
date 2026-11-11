"use client"

import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { useOpenIncidents, useIngestOverview } from "@/features/integrations"
import { useMonitors } from "@/features/monitors"
import { useSchedules } from "@/features/oncall"
import { useStatusPages } from "@/features/status"
import { ROUTES } from "@/lib/constants/routes"
import { cn } from "@/lib/utils"

interface TodayStoryProps {
  workspaceId: string
}

export function TodayStory({ workspaceId }: TodayStoryProps) {
  const incidents = useOpenIncidents(workspaceId, true)
  const overview = useIngestOverview(workspaceId, false)
  const monitors = useMonitors(workspaceId)
  const schedules = useSchedules(workspaceId)
  const pages = useStatusPages(workspaceId)

  const open = incidents.data ?? []
  const down = (monitors.data ?? []).filter((m) => m.state === "down")
  const steps = [
    {
      label: "Connect your app",
      help: "Send logs and errors so there is something to watch.",
      href: ROUTES.integrations,
      done: overview.data?.ways.some((w) => w.state !== "not_set_up") ?? false,
    },
    {
      label: "Watch it from outside",
      help: "Add a monitor so you know the moment it stops answering.",
      href: ROUTES.monitors,
      done: (monitors.data ?? []).length > 0,
    },
    {
      label: "Decide who gets woken up",
      help: "Create an on-call schedule so a person is always ready.",
      href: ROUTES.oncall,
      done: (schedules.data ?? []).length > 0,
    },
    {
      label: "Tell your users",
      help: "Publish a status page that updates itself.",
      href: ROUTES.statusPages,
      done: (pages.data ?? []).length > 0,
    },
  ]
  const finished = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  const quiet = open.length === 0 && down.length === 0

  return (
    <section aria-label="Today" className="grid gap-5 border border-line bg-panel p-6">
      <div className="grid gap-1">
        <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          Today
        </p>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {quiet
            ? "All quiet. Nothing needs you right now."
            : `${open.length + down.length} thing${open.length + down.length === 1 ? "" : "s"} need${open.length + down.length === 1 ? "s" : ""} you.`}
        </h2>
        {down.length > 0 && (
          <p className="text-sm text-danger">
            {down.map((m) => m.name).join(", ")} {down.length === 1 ? "is" : "are"} not answering.
          </p>
        )}
      </div>
      {open.length > 0 && (
        <ul className="grid gap-2">
          {open.slice(0, 3).map((incident) => (
            <li key={incident.id}>
              <Link
                href={ROUTES.incidentDetail(incident.id)}
                className="flex items-center justify-between gap-3 border border-line px-4 py-3 text-sm outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
              >
                <span className="min-w-0 truncate font-medium">{incident.title}</span>
                <span className="flex items-center gap-1 text-brand-strong">
                  Open the story <ArrowRight className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {finished < steps.length && (
        <div className="grid gap-3 border-t border-line pt-5">
          <p className="text-sm">
            <span className="font-medium">Your path:</span> {finished} of {steps.length} done
            {next ? `. Next: ${next.label.toLowerCase()}.` : "."}
          </p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={cn(
                    "grid h-full gap-1 border p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/40",
                    step.done
                      ? "border-ok/40 bg-ok/10"
                      : step === next
                        ? "border-brand bg-brand-soft"
                        : "border-line hover:bg-panel-2"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {step.done ? (
                      <Check className="size-4 text-ok" />
                    ) : (
                      <span className="font-mono text-[0.75rem] text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                    {step.label}
                  </span>
                  <span className="text-[0.8125rem] text-muted-foreground">{step.help}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
