"use client"

import { Spinner } from "@/components/ui"
import { VITAL_LIMITS } from "../constants"
import { useRumOverview } from "../hooks"
import { pathOf } from "../lib"

interface OverviewPanelProps {
  workspaceId: string
  appId: string
  minutes: number
}

const tone = (name: string, value: number | null) => {
  const limit = VITAL_LIMITS[name]
  if (value === null || !limit) return "text-muted-foreground"
  if (value <= limit.good) return "text-ok"
  return value <= limit.poor ? "text-warn" : "text-danger"
}

export function OverviewPanel({ workspaceId, appId, minutes }: OverviewPanelProps) {
  const overview = useRumOverview(workspaceId, appId, minutes)

  if (overview.isPending) return <Spinner className="size-5" />
  const data = overview.data
  if (!data) return null
  const peak = Math.max(1, ...data.trend.map((t) => t.sessions))

  return (
    <div className="grid gap-6">
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ["Sessions", data.sessions],
          ["Users", data.users],
          ["Page views", data.pageViews],
          ["Errors", data.errors],
        ].map(([label, value]) => (
          <div key={label} className="border border-line bg-panel p-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="font-heading text-2xl font-semibold">{value!.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <section className="grid gap-2" aria-label="Sessions over time">
        <h2 className="text-xs font-medium text-muted-foreground">Sessions over time</h2>
        <div className="flex h-24 items-end gap-px border-b border-line">
          {data.trend.map((t) => (
            <span
              key={t.at}
              title={`${t.sessions} sessions, ${t.errors} errors`}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={t.errors ? "block w-full bg-danger/70" : "block w-full bg-brand/60"}
                style={{ height: `${t.sessions ? Math.max(6, (t.sessions / peak) * 100) : 2}%` }}
              />
            </span>
          ))}
        </div>
      </section>
      <section className="grid gap-2" aria-label="Web vitals">
        <h2 className="text-xs font-medium text-muted-foreground">
          How fast pages feel (75th percentile)
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(VITAL_LIMITS).map(([name, limit]) => {
            const vital = data.vitals.find((v) => v.name === name)
            const value = vital?.p75 ?? null
            return (
              <div key={name} className="border border-line bg-panel p-3">
                <div className="text-[0.75rem] text-muted-foreground">{limit.label}</div>
                <div className={`font-heading text-xl font-semibold ${tone(name, value)}`}>
                  {value === null
                    ? "—"
                    : name === "CLS"
                      ? value.toFixed(3)
                      : `${Math.round(value)} ${limit.unit}`}
                </div>
                <div className="font-mono text-[0.6875rem] text-muted-foreground">
                  {name} · {vital?.samples ?? 0} samples
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <section className="grid gap-2" aria-label="Top pages">
        <h2 className="text-xs font-medium text-muted-foreground">Top pages</h2>
        {data.topPages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No page views yet.</p>
        ) : (
          <ul className="grid gap-1">
            {data.topPages.map((page) => (
              <li
                key={page.url}
                className="flex justify-between gap-2 border border-line px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-mono">{pathOf(page.url)}</span>
                <span>{page.views.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
