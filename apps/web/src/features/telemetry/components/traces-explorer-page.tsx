"use client"

import * as React from "react"
import { Button, Eyebrow, Input, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ROUTES } from "@/lib/constants/routes"
import { useRouter } from "next/navigation"
import { TRACE_HINT } from "../constants"
import { useExploreParams, useOperations, useTraceSearch } from "../hooks"
import { ExploreHeader } from "./explore-header"
import { ExploreQueryBar } from "./explore-query-bar"
import { OperationsTable } from "./operations-table"
import { QueryMetaLine } from "./query-meta-line"
import { TraceList } from "./trace-list"

export function TracesExplorerPage() {
  const router = useRouter()
  const { workspace, isPending } = useCurrentWorkspace()
  const { params, update } = useExploreParams()
  const workspaceId = workspace?.id
  const search = useTraceSearch(workspaceId, params)
  const operations = useOperations(workspaceId, params)
  const [traceId, setTraceId] = React.useState("")

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null

  const pages = search.data?.pages ?? []
  const traces = pages.flatMap((page) => page.traces)

  return (
    <div className="grid min-w-0 gap-6">
      <ExploreHeader active="traces" title="Explore traces" />
      <ExploreQueryBar
        key={`${params.q}|${params.from}|${params.to}`}
        workspaceId={workspace.id}
        signal="traces"
        value={params}
        hint={TRACE_HINT}
        error={search.error?.message}
        onChange={update}
      />
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (traceId.trim()) router.push(ROUTES.traceDetail(traceId.trim()))
        }}
      >
        <Eyebrow>Trace ID</Eyebrow>
        <Input
          aria-label="Trace ID"
          value={traceId}
          onChange={(event) => setTraceId(event.target.value)}
          className="h-8 w-auto min-w-72 font-mono text-[0.75rem]"
        />
        <Button type="submit" size="sm" variant="outline">
          Open
        </Button>
      </form>
      <section className="grid gap-3" aria-labelledby="ops-title">
        <h2 id="ops-title" className="font-heading text-base font-semibold">
          Duration by operation
        </h2>
        {operations.data ? (
          <OperationsTable operations={operations.data} onPick={(term) => update({ q: term })} />
        ) : (
          <Spinner />
        )}
      </section>
      <section className="grid gap-3" aria-labelledby="traces-title">
        <h2 id="traces-title" className="font-heading text-base font-semibold">
          Traces
        </h2>
        {pages[0] && <QueryMetaLine meta={pages[0].meta} shown={traces.length} noun="traces" />}
        {traces.length === 0 ? (
          <p className="border border-dashed border-line p-6 text-[0.8125rem] text-muted-foreground">
            {search.isFetching ? "Searching" : "No traces match this query in this time range."}
          </p>
        ) : (
          <TraceList traces={traces} />
        )}
        {search.hasNextPage && (
          <Button
            variant="outline"
            className="justify-self-center"
            disabled={search.isFetchingNextPage}
            onClick={() => void search.fetchNextPage()}
          >
            Load older traces
          </Button>
        )}
      </section>
    </div>
  )
}
