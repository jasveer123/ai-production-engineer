import { Badge, Eyebrow } from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import { SPAN_ERROR } from "../constants"
import type { WaterfallSpan } from "../explore-schemas"
import { formatDuration } from "../lib"

interface SpanDetailProps {
  span: WaterfallSpan
}

const KIND = ["unspecified", "internal", "server", "client", "producer", "consumer"]
const STATUS = ["unset", "ok", "error"]

export function SpanDetail({ span }: SpanDetailProps) {
  return (
    <section className="grid content-start gap-3 border border-line bg-panel p-4" aria-label="Span">
      <div className="grid gap-1">
        <h2 className="font-heading text-base font-semibold break-words">{span.name}</h2>
        <p className="text-[0.75rem] text-muted-foreground">
          {span.service} · {span.environment} · {KIND[span.kind] ?? span.kind}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.75rem]">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant={span.statusCode === SPAN_ERROR ? "destructive" : "default"}>
            {STATUS[span.statusCode] ?? span.statusCode}
          </Badge>{" "}
          {span.statusMessage}
        </dd>
        <dt className="text-muted-foreground">Started</dt>
        <dd className="font-mono">{formatDateTime(span.start)}</dd>
        <dt className="text-muted-foreground">Duration</dt>
        <dd className="font-mono">{formatDuration(span.durationMs)}</dd>
        <dt className="text-muted-foreground">Span</dt>
        <dd className="font-mono break-all">{span.spanId}</dd>
        <dt className="text-muted-foreground">Parent</dt>
        <dd className="font-mono break-all">
          {span.parentSpanId ?? "none (root)"}
          {span.orphan && " (not received)"}
        </dd>
      </dl>
      <Eyebrow>Attributes</Eyebrow>
      <pre className="overflow-x-auto border border-line bg-sunken p-3 font-mono text-[0.75rem] leading-5">
        {JSON.stringify(span.attributes, null, 2)}
      </pre>
      {span.events.length > 0 && (
        <>
          <Eyebrow>Events</Eyebrow>
          <ul className="grid gap-2">
            {span.events.map((event, index) => (
              <li key={`${event.name}-${index}`} className="grid gap-1 text-[0.75rem]">
                <span className="font-medium">
                  {event.name}{" "}
                  <span className="font-mono text-muted-foreground">
                    {formatDateTime(event.time)}
                  </span>
                </span>
                {Object.keys(event.attributes).length > 0 && (
                  <pre className="overflow-x-auto border border-line bg-sunken p-2 font-mono">
                    {JSON.stringify(event.attributes, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
