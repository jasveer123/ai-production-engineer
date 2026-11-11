"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge, Button, CodeBlock, Eyebrow, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { ROUTES } from "@/lib/constants/routes"
import { formatDateTime, formatRelativeTime } from "@/lib/format/relative-time"
import { STATUS_VARIANT } from "../constants"
import { useError, useSetErrorStatus } from "../hooks"

export function ErrorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { workspace, isPending } = useCurrentWorkspace()
  const error = useError(workspace?.id, id)
  const setStatus = useSetErrorStatus(workspace?.id ?? "", id)

  if (isPending || (workspace && error.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  if (!error.data) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">This error was not found.</p>
    )
  }

  const data = error.data
  const canAct = ACTOR_ROLES.includes(workspace.role)
  const peak = Math.max(1, ...data.hourly.map((h) => h.count))

  return (
    <div className="grid min-w-0 gap-6">
      <Link
        href={ROUTES.errors}
        className="inline-flex w-fit items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-text"
      >
        <ArrowLeft className="size-4" /> All errors
      </Link>
      <header className="grid gap-3 border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[data.status] ?? "default"}>{data.status}</Badge>
          <Badge>{data.service}</Badge>
          <Badge>{data.environment}</Badge>
          {data.release && <Badge>{data.release}</Badge>}
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">{data.title}</h1>
        <p className="text-[0.8125rem] text-muted-foreground">
          {data.count.toLocaleString()} events · first seen {formatRelativeTime(data.firstSeenAt)} ·
          last seen {formatRelativeTime(data.lastSeenAt)}
          {data.route ? ` · ${data.route}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {canAct && data.status !== "resolved" && (
            <Button
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("resolved")}
            >
              Resolve
            </Button>
          )}
          {canAct && data.status !== "ignored" && (
            <Button
              size="sm"
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("ignored")}
            >
              Ignore
            </Button>
          )}
          {canAct && data.status !== "unresolved" && (
            <Button
              size="sm"
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("unresolved")}
            >
              Reopen
            </Button>
          )}
          {data.incidentId && (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={ROUTES.incidentDetail(data.incidentId)} />}
            >
              Open incident
            </Button>
          )}
        </div>
      </header>
      <section className="grid gap-2" aria-label="Last 24 hours">
        <Eyebrow>Last 24 hours</Eyebrow>
        <div className="flex h-24 items-end gap-px border-b border-line">
          {data.hourly.map((hour) => (
            <span
              key={hour.at}
              className="flex h-full min-w-0 flex-1 items-end"
              title={`${formatDateTime(hour.at)}: ${hour.count}`}
            >
              <span
                className={hour.count ? "block w-full bg-danger/70" : "block w-full bg-line"}
                style={{ height: hour.count ? `${Math.max(6, (hour.count / peak) * 100)}%` : "2%" }}
              />
            </span>
          ))}
        </div>
      </section>
      {data.stack.length > 0 && (
        <section className="grid gap-2">
          <Eyebrow>Stack trace</Eyebrow>
          <CodeBlock>{data.stack.join("\n")}</CodeBlock>
        </section>
      )}
      <section className="grid gap-2">
        <Eyebrow>Recent events</Eyebrow>
        <ul className="grid gap-1">
          {data.occurrences.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{item.message}</span>
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {formatDateTime(item.occurredAt)}
                {item.traceId ? ` · trace ${item.traceId.slice(0, 8)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
