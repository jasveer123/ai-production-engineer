import { Badge } from "@/components/ui"
import { cn } from "@/lib/utils"
import { STATE_LABEL, STATE_TONE } from "../constants"
import type { Report } from "../schemas"

interface PublicReportProps {
  report: Report
}

const stamp = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  )

export function PublicReport({ report }: PublicReportProps) {
  return (
    <article className="grid gap-2 border border-line bg-panel p-4" aria-label={report.title}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={report.resolvedAt ? "success" : "warning"}>{report.state}</Badge>
        <h3 className="font-semibold">{report.title}</h3>
      </div>
      {report.affected.length > 0 && (
        <p className="flex flex-wrap gap-3 text-[0.75rem]">
          {report.affected.map((a) => (
            <span key={a.resourceId} className={cn("font-medium", STATE_TONE[a.impact])}>
              {a.name}: {STATE_LABEL[a.impact] ?? a.impact}
            </span>
          ))}
        </p>
      )}
      <ol className="grid gap-2 border-l border-line pl-3">
        {report.updates.map((u) => (
          <li key={u.id} className="grid gap-0.5 text-sm">
            <span>
              <span className="font-semibold capitalize">{u.state}</span> · {u.body}
            </span>
            <time dateTime={u.createdAt} className="text-[0.75rem] text-muted-foreground">
              {stamp(u.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </article>
  )
}
