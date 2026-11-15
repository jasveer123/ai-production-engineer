import Link from "next/link"
import { STATUS_ENDPOINTS, apiUrl } from "@/lib/api"
import { OVERALL_LABEL, OVERALL_TONE } from "../constants"
import type { PublicStatus } from "../schemas"
import { MaintenanceItem } from "./maintenance-item"
import { PageTheme } from "./page-theme"
import { PublicHeader } from "./public-header"
import { PublicReport } from "./public-report"
import { PublicResource } from "./public-resource"
import { SubscribeForm } from "./subscribe-form"

interface PublicStatusViewProps {
  data: PublicStatus
}

export function PublicStatusView({ data }: PublicStatusViewProps) {
  const active = data.reports.filter((r) => !r.resolvedAt)
  const recent = data.reports.filter((r) => r.resolvedAt)

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12 sm:px-6">
      <PageTheme theme={data.theme} hideFromSearch={data.hideFromSearch} />
      <PublicHeader data={data} />
      <div className="flex items-center gap-3 border border-line bg-panel p-5" role="status">
        <span
          className={`size-3 rounded-full ${OVERALL_TONE[data.overall] ?? "bg-line"}`}
          aria-hidden
        />
        <p className="font-semibold">{OVERALL_LABEL[data.overall] ?? data.overall}</p>
      </div>
      {active.length > 0 && (
        <section className="grid gap-3" aria-label="Active incidents">
          <h2 className="font-heading text-lg font-semibold">Active incidents</h2>
          {active.map((r) => (
            <PublicReport key={r.id} report={r} />
          ))}
        </section>
      )}
      {data.maintenances.length > 0 && (
        <section className="grid gap-3" aria-label="Maintenance">
          <h2 className="font-heading text-lg font-semibold">Maintenance</h2>
          {data.maintenances.map((m) => (
            <MaintenanceItem key={m.id} maintenance={m} />
          ))}
        </section>
      )}
      {data.sections.map((section) => (
        <section key={section.id} className="grid gap-2" aria-label={section.name || "Services"}>
          {section.name && <h2 className="font-heading text-lg font-semibold">{section.name}</h2>}
          <div className="grid divide-y divide-line border border-line bg-panel">
            {section.resources.map((r) => (
              <PublicResource key={r.id} resource={r} />
            ))}
          </div>
        </section>
      ))}
      {recent.length > 0 && (
        <section className="grid gap-3" aria-label="Recently resolved">
          <h2 className="font-heading text-lg font-semibold">Recently resolved</h2>
          {recent.map((r) => (
            <PublicReport key={r.id} report={r} />
          ))}
        </section>
      )}
      <SubscribeForm slug={data.slug} />
      <footer className="flex flex-wrap gap-4 text-[0.8125rem] text-muted-foreground">
        <Link href={`/status/${data.slug}/history`} className="hover:text-text hover:underline">
          Incident history
        </Link>
        <a
          href={apiUrl(STATUS_ENDPOINTS.FEED_ATOM(data.slug))}
          className="hover:text-text hover:underline"
        >
          Atom feed
        </a>
        <a
          href={apiUrl(STATUS_ENDPOINTS.FEED_RSS(data.slug))}
          className="hover:text-text hover:underline"
        >
          RSS feed
        </a>
        <a
          href={apiUrl(STATUS_ENDPOINTS.SUMMARY(data.slug))}
          className="hover:text-text hover:underline"
        >
          JSON summary
        </a>
      </footer>
    </main>
  )
}
