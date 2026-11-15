"use client"

import * as React from "react"
import { Alert, Spinner } from "@/components/ui"
import { StatusStrip } from "@/components/shared"
import { useCurrentWorkspace } from "@/features/auth"
import { formatDateTime } from "@/lib/format/relative-time"
import { SPAN_ERROR } from "../constants"
import { useTraceDetail } from "../hooks"
import { formatDuration } from "../lib"
import { ExploreHeader } from "./explore-header"
import { LogList } from "./log-list"
import { SpanDetail } from "./span-detail"
import { WaterfallRow } from "./waterfall-row"

interface TraceDetailPageProps {
  traceId: string
}

export function TraceDetailPage({ traceId }: TraceDetailPageProps) {
  const { workspace, isPending } = useCurrentWorkspace()
  const { data, isPending: loading } = useTraceDetail(workspace?.id, traceId)
  const [selected, setSelected] = React.useState<string | null>(null)

  if (isPending || (workspace && loading)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!workspace || !data) return null

  const errors = data.spans.filter((span) => span.statusCode === SPAN_ERROR).length
  const services = new Set(data.spans.map((span) => span.service)).size
  const active = data.spans.find((span) => span.spanId === selected) ?? data.spans[0]
  const incomplete = data.missingRoot || data.orphanCount > 0

  return (
    <div className="grid min-w-0 gap-6">
      <ExploreHeader active="traces" title={`Trace ${traceId}`} />
      {data.spans.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No spans with this trace ID were received in this workspace.
        </p>
      ) : (
        <>
          <StatusStrip
            tone={errors > 0 ? "bad" : incomplete ? "warn" : "ok"}
            headline={errors > 0 ? `${errors} span${errors === 1 ? "" : "s"} failed` : "No errors"}
            detail={data.start ? `Started ${formatDateTime(data.start)}` : undefined}
            stats={[
              { label: "Duration", value: formatDuration(data.durationMs) },
              { label: "Spans", value: data.spans.length },
              { label: "Services", value: services },
              { label: "Logs", value: data.logs.length },
            ]}
          />
          {incomplete && (
            <Alert>
              This trace is incomplete.
              {data.missingRoot && " The root span was not received."}
              {data.orphanCount > 0 &&
                ` ${data.orphanCount} span${data.orphanCount === 1 ? " has" : "s have"} a parent that was not received; they are shown at the top level.`}
            </Alert>
          )}
          {data.truncated && <Alert>Only the first 2,000 spans are shown.</Alert>}
          <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_24rem]">
            <ul className="min-w-0 overflow-x-auto border border-line bg-sunken py-1">
              {data.spans.map((span) => (
                <WaterfallRow
                  key={span.spanId}
                  span={span}
                  totalMs={data.durationMs}
                  selected={span.spanId === active?.spanId}
                  onSelect={setSelected}
                />
              ))}
            </ul>
            {active && <SpanDetail span={active} />}
          </div>
        </>
      )}
      <section className="grid gap-3" aria-labelledby="trace-logs">
        <h2 id="trace-logs" className="font-heading text-base font-semibold">
          Logs in this trace
        </h2>
        <LogList lines={data.logs} loading={false} emptyText="No logs carry this trace ID." />
      </section>
    </div>
  )
}
