"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { INTEGRATIONS } from "../catalog"
import { useIngestOverview } from "../hooks"
import { Catalogue, type GroupFilter } from "./catalogue"
import { PageHeading } from "./page-heading"

export function IntegrationsPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const { data: overview } = useIngestOverview(workspace?.id)
  const [group, setGroup] = React.useState<GroupFilter>("all")
  const [search, setSearch] = React.useState("")

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return INTEGRATIONS.filter(
      (item) =>
        (group === "all" || item.group === group) &&
        (!term || `${item.name} ${item.tagline}`.toLowerCase().includes(term))
    )
  }, [group, search])

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <p className="mx-auto max-w-md border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
        You are not in a workspace yet. Ask an owner to invite you.
      </p>
    )
  }

  return (
    <div className="grid min-w-0 gap-8">
      <PageHeading workspaceName={workspace.name} title="Integrations" />
      <Catalogue
        all={INTEGRATIONS}
        visible={visible}
        overview={overview}
        group={group}
        search={search}
        onGroupChange={setGroup}
        onSearchChange={setSearch}
      />
    </div>
  )
}
