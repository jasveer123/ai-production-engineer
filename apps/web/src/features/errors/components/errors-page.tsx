"use client"

import * as React from "react"
import Link from "next/link"
import { Badge, Chip, Input, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { STATUS_FILTERS, STATUS_VARIANT } from "../constants"
import { useErrors } from "../hooks"

export function ErrorsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const [status, setStatus] = React.useState<string>("unresolved")
  const [q, setQ] = React.useState("")
  const errors = useErrors(workspace?.id, status, q.trim())

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = errors.data ?? []

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Errors" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Chip
              key={item.value}
              selected={status === item.value}
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <Input
          aria-label="Search errors"
          className="w-64"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search errors"
        />
      </div>
      {errors.isPending ? (
        <div className="grid place-items-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No errors here. Errors from your apps are grouped automatically once they are reported.
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={ROUTES.errorDetail(item.id)}
                className="grid gap-1 border border-line bg-panel p-4 outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{item.title}</span>
                  <Badge variant={STATUS_VARIANT[item.status] ?? "default"}>
                    {item.reopenedAt && item.status === "unresolved" ? "regressed" : item.status}
                  </Badge>
                </div>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {item.service} · {item.environment} · {item.count.toLocaleString()} events · last
                  seen {formatRelativeTime(item.lastSeenAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
