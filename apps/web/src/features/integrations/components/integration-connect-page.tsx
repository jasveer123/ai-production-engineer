"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, BookOpen } from "lucide-react"
import { Badge, Button, Eyebrow, Separator, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { INTEGRATIONS } from "../catalog"
import { COLLECTOR, type IntegrationId } from "../constants"
import { useIngestOverview, useTokenSecret } from "../hooks"
import type { StreamState } from "../schemas"
import { CollectorCard } from "./collector-card"
import { LiveLogs } from "./live-logs"
import { SendTestLogButton } from "./send-test-log-button"
import { StateBadge } from "./state-badge"
import { TokenPanel } from "./token-panel"

interface IntegrationConnectPageProps {
  id: IntegrationId
}

export function IntegrationConnectPage({ id }: IntegrationConnectPageProps) {
  const definition = INTEGRATIONS.find((item) => item.id === id)!
  const Icon = definition.icon
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const { data: overview } = useIngestOverview(workspace?.id)
  const { secret, setSecret } = useTokenSecret()

  if (isPending || (workspace && !overview)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace || !overview) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        You are not in a workspace yet. Ask an owner to invite you.
      </p>
    )
  }

  const way = overview.ways.find((item) => item.way === definition.way)
  const state: StreamState = way?.state ?? "not_set_up"

  const collectorAnchor = (COLLECTOR.INTEGRATIONS as readonly string[]).includes(definition.id)
    ? definition.id
    : null

  return (
    <article className="mx-auto grid max-w-3xl gap-8" aria-label={`${definition.name} connection`}>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={ROUTES.integrations} />}
      >
        <ArrowLeft /> All integrations
      </Button>
      <header className="grid gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center border border-line-strong bg-panel-2 text-brand">
            <Icon className="size-8" />
          </span>
          <div className="grid min-w-0 gap-1">
            <Eyebrow>Workspace · {workspace.name}</Eyebrow>
            <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
              {definition.name}
            </h1>
            <span className="text-sm text-muted-foreground">{definition.tagline}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={state} />
          <Badge>{definition.codeChange ? "Adds a package" : "No code changes"}</Badge>
          {way?.lastReceivedAt && (
            <span className="text-[0.8125rem] text-muted-foreground">
              Last log {formatRelativeTime(way.lastReceivedAt)}
            </span>
          )}
        </div>
        <p className="text-sm leading-6">{definition.description}</p>
      </header>
      {collectorAnchor && <CollectorCard anchor={collectorAnchor} />}
      <section className="grid gap-5" aria-labelledby="connect-title">
        <h2 id="connect-title" className="font-heading text-xl font-semibold">
          Connect
        </h2>
        <TokenPanel
          workspaceId={workspace.id}
          tokens={overview.tokens}
          canManage={canManage}
          secret={secret}
          onSecretChange={setSecret}
        />
      </section>
      <Separator />
      <section className="grid gap-4" aria-labelledby="verify-title">
        <h2 id="verify-title" className="font-heading text-xl font-semibold">
          Check it works
        </h2>
        <SendTestLogButton workspaceId={workspace.id} token={secret?.token ?? null} />
        <LiveLogs workspaceId={workspace.id} />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 border border-line bg-panel p-5">
        <div className="grid gap-1">
          <h2 className="font-heading text-base font-semibold">Not sure how to set it up?</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            The step-by-step guide for {definition.name} lives in the public docs.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={ROUTES.integrationDocs(definition.id)} target="_blank" />}
        >
          <BookOpen /> Know how to integrate
        </Button>
      </section>
    </article>
  )
}
