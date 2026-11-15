import { Eyebrow } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import type { ErrorBreadcrumb } from "../schemas"

interface BreadcrumbsListProps {
  items: ErrorBreadcrumb[]
}

export function BreadcrumbsList({ items }: BreadcrumbsListProps) {
  if (items.length === 0) return null
  return (
    <section className="grid gap-2" aria-label="Breadcrumbs">
      <Eyebrow>Breadcrumbs</Eyebrow>
      <ol className="grid gap-px border border-line">
        {[...items].reverse().map((crumb, i) => (
          <li key={i} className="grid grid-cols-[8rem_7rem_1fr] gap-3 px-3 py-1.5 text-[0.8125rem]">
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {crumb.ts ? formatDateTime(new Date(crumb.ts).toISOString()) : "-"}
            </span>
            <span className="truncate font-medium">{crumb.category ?? crumb.type ?? "event"}</span>
            <span className="min-w-0 truncate">{crumb.message ?? ""}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
