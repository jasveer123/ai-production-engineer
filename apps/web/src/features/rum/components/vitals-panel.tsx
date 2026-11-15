"use client"

import { Eyebrow, Spinner } from "@/components/ui"
import { useRumVitals } from "../hooks"
import { formatVital } from "../lib"
import { VitalCard } from "./vital-card"

interface VitalsPanelProps {
  workspaceId: string
  appId: string
  minutes: number
}

const NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"]

export function VitalsPanel({ workspaceId, appId, minutes }: VitalsPanelProps) {
  const report = useRumVitals(workspaceId, appId, minutes)
  if (report.isPending) return <Spinner className="size-5" />
  const data = report.data ?? { vitals: [], pages: [] }
  if (data.vitals.length === 0)
    return (
      <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        No page speed samples in this period. They are sent when a visitor leaves or hides a page.
      </p>
    )
  const ordered = NAMES.map((n) => data.vitals.find((v) => v.name === n)).filter(
    (v): v is NonNullable<typeof v> => Boolean(v)
  )

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ordered.map((vital) => (
          <VitalCard key={vital.name} vital={vital} />
        ))}
      </div>
      <section className="grid gap-2" aria-label="By page">
        <Eyebrow>By page (p75)</Eyebrow>
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-[0.8125rem]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Page</th>
                {NAMES.map((n) => (
                  <th key={n} className="px-3 py-2 font-medium">
                    {n}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Samples</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((page) => (
                <tr key={page.path} className="border-t border-line">
                  <td className="max-w-[20rem] truncate px-3 py-2 font-mono">{page.path}</td>
                  {NAMES.map((n) => (
                    <td key={n} className="px-3 py-2">
                      {formatVital(n, page.p75[n] ?? null)}
                    </td>
                  ))}
                  <td className="px-3 py-2">{page.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
