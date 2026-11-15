"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button, Spinner } from "@/components/ui"
import { usePublicHistory } from "../hooks"
import { MaintenanceItem } from "./maintenance-item"
import { PublicReport } from "./public-report"

interface PublicHistoryPageProps {
  params: Promise<{ slug: string }>
}

const shift = (month: string, delta: number) => {
  const d = new Date(`${month}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 7)
}

const label = (month: string) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`)
  )

export function PublicHistoryPage({ params }: PublicHistoryPageProps) {
  const { slug } = React.use(params)
  const current = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = React.useState(current)
  const history = usePublicHistory(slug, month)

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12 sm:px-6">
      <Link href={`/status/${slug}`} className="text-[0.8125rem] text-brand-strong hover:underline">
        Back to current status
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">
          {history.data?.name ?? "Incident history"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth(shift(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{label(month)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={month >= current}
            onClick={() => setMonth(shift(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>
      {history.isPending && <Spinner className="mx-auto size-6" />}
      {history.isError && (
        <p className="text-sm text-muted-foreground">
          This history is not available. Open the status page first if it is private.
        </p>
      )}
      {history.data &&
        history.data.reports.length === 0 &&
        history.data.maintenances.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No incidents or maintenance in {label(month)}.
          </p>
        )}
      {history.data?.reports.map((r) => (
        <PublicReport key={r.id} report={r} />
      ))}
      {history.data?.maintenances.map((m) => (
        <MaintenanceItem key={m.id} maintenance={m} />
      ))}
    </main>
  )
}
