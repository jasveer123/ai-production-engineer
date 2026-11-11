"use client"

import * as React from "react"
import { Badge, Spinner } from "@/components/ui"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { COMPONENT_LABEL, OVERALL_LABEL, OVERALL_TONE } from "../constants"
import { usePublicStatus } from "../hooks"
import type { PublicStatus } from "../schemas"
import { SubscribeForm } from "./subscribe-form"
import { UptimeBars } from "./uptime-bars"

interface PublicStatusPageProps {
  params: Promise<{ slug: string }>
}

export function PublicStatusPage({ params }: PublicStatusPageProps) {
  const { slug } = React.use(params)
  const status = usePublicStatus(slug)

  if (status.isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!status.data) {
    return (
      <main className="mx-auto grid max-w-3xl gap-2 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Status page not found</h1>
        <p className="text-sm text-muted-foreground">Check the address and try again.</p>
      </main>
    )
  }

  return <PublicStatusView data={status.data} />
}

export function PublicStatusView({ data }: { data: PublicStatus }) {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-6 py-12">
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{data.name}</h1>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      </header>
      <div className="flex items-center gap-3 border border-line bg-panel p-5">
        <span className={`size-3 rounded-full ${OVERALL_TONE[data.overall] ?? "bg-line"}`} />
        <p className="font-semibold">{OVERALL_LABEL[data.overall] ?? data.overall}</p>
      </div>
      <section className="grid gap-4" aria-label="Components">
        {data.components.map((component) => (
          <article key={component.name} className="grid gap-2 border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{component.name}</h2>
              <span className="text-[0.8125rem] text-muted-foreground">
                {COMPONENT_LABEL[component.state] ?? component.state}
              </span>
            </div>
            <UptimeBars days={component.days} />
            <div className="flex justify-between text-[0.75rem] text-muted-foreground">
              <span>90 days ago</span>
              <span>
                {component.uptime === null ? "No data yet" : `${component.uptime}% uptime`}
              </span>
              <span>Today</span>
            </div>
          </article>
        ))}
      </section>
      <SubscribeForm slug={data.slug} />
      {data.updates.length > 0 && (
        <section className="grid gap-3" aria-label="Updates">
          <h2 className="font-heading text-lg font-semibold">Updates</h2>
          {data.updates.map((update) => (
            <article key={update.id} className="grid gap-1 border border-line bg-panel p-4">
              <div className="flex items-center gap-2">
                <Badge>{update.state}</Badge>
                <span className="font-semibold">{update.title}</span>
                {update.auto && (
                  <span className="text-[0.75rem] text-muted-foreground">automatic</span>
                )}
              </div>
              {update.body && <p className="text-sm leading-6">{update.body}</p>}
              <p className="text-[0.75rem] text-muted-foreground">
                {formatRelativeTime(update.createdAt)}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
