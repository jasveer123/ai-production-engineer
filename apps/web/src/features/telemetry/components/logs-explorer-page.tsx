"use client"

import * as React from "react"
import { Button, Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { EXPLORE_HINT } from "../constants"
import { useExploreParams, useLogExplore } from "../hooks"
import type { LogLine } from "../schemas"
import { ExploreHeader } from "./explore-header"
import { ExploreLogActions } from "./explore-log-actions"
import { ExploreQueryBar } from "./explore-query-bar"
import { FacetPanel } from "./facet-panel"
import { LevelHistogram } from "./level-histogram"
import { LogContextDrawer } from "./log-context-drawer"
import { LogRow } from "./log-row"
import { QueryMetaLine } from "./query-meta-line"

export function LogsExplorerPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const { params, update } = useExploreParams()
  const result = useLogExplore(workspace?.id, params)
  const [contextLine, setContextLine] = React.useState<LogLine | null>(null)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace) return null

  const pages = result.data?.pages ?? []
  const first = pages[0]
  const lines = pages.flatMap((page) => page.lines)
  const addTerm = (term: string) => update({ q: `${params.q} ${term}`.trim() })

  return (
    <div className="grid min-w-0 gap-6">
      <ExploreHeader active="logs" title="Explore logs" />
      <ExploreQueryBar
        key={`${params.q}|${params.from}|${params.to}`}
        workspaceId={workspace.id}
        signal="logs"
        value={params}
        hint={EXPLORE_HINT}
        error={result.error?.message}
        onChange={update}
      />
      {first && (
        <div className="grid gap-3 border border-line bg-panel p-4">
          <QueryMetaLine meta={first.meta} shown={lines.length} noun="lines" />
          <LevelHistogram
            buckets={first.histogram}
            bucketMs={first.bucketMs}
            onSelect={(from, to) => update({ from, to })}
          />
        </div>
      )}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[15rem_1fr]">
        <FacetPanel workspaceId={workspace.id} params={params} onFilter={addTerm} />
        <div className="grid min-w-0 content-start gap-3">
          {lines.length === 0 ? (
            <div className="flex items-center gap-3 border border-dashed border-line p-6 text-[0.8125rem] text-muted-foreground">
              {result.isFetching && <Spinner />}
              {result.isFetching ? "Searching" : "No logs match this query in this time range."}
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line bg-sunken">
              {lines.map((line) => (
                <LogRow
                  key={line.id}
                  line={line}
                  actions={
                    <ExploreLogActions line={line} onContext={setContextLine} onFilter={addTerm} />
                  }
                />
              ))}
            </ul>
          )}
          {result.hasNextPage && (
            <Button
              variant="outline"
              className="justify-self-center"
              disabled={result.isFetchingNextPage}
              onClick={() => void result.fetchNextPage()}
            >
              {result.isFetchingNextPage ? "Loading" : "Load older lines"}
            </Button>
          )}
        </div>
      </div>
      <LogContextDrawer
        workspaceId={workspace.id}
        line={contextLine}
        onClose={() => setContextLine(null)}
      />
    </div>
  )
}
