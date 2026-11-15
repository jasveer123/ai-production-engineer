"use client"

import Link from "next/link"
import { Badge, Button } from "@/components/ui"
import type { StatusPage } from "../schemas"

interface PageCardProps {
  page: StatusPage
}

export function PageCard({ page }: PageCardProps) {
  return (
    <article
      className="flex flex-wrap items-center justify-between gap-3 border border-line bg-panel p-5"
      aria-label={page.name}
    >
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">{page.name}</h2>
          {page.isPrivate && <Badge variant="info">private</Badge>}
          {page.openReports > 0 && (
            <Badge variant="warning">
              {page.openReports} open report{page.openReports === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <a
          href={`/status/${page.slug}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.75rem] text-brand-strong hover:underline"
        >
          /status/{page.slug}
        </a>
        <span className="text-[0.75rem] text-muted-foreground">
          {page.subscribers} confirmed subscriber{page.subscribers === 1 ? "" : "s"}
          {page.customDomain ? ` · ${page.customDomain}` : ""}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link href={`/status-pages/${page.id}`} />}
      >
        Edit page
      </Button>
    </article>
  )
}
