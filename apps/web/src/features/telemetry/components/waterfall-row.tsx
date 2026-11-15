import { cn } from "@/lib/utils"
import { SPAN_ERROR } from "../constants"
import type { WaterfallSpan } from "../explore-schemas"
import { formatDuration } from "../lib"

interface WaterfallRowProps {
  span: WaterfallSpan
  totalMs: number
  selected: boolean
  onSelect: (spanId: string) => void
}

export function WaterfallRow({ span, totalMs, selected, onSelect }: WaterfallRowProps) {
  const total = Math.max(totalMs, 0.001)
  const left = (span.offsetMs / total) * 100
  const width = Math.max(0.4, (span.durationMs / total) * 100)
  const error = span.statusCode === SPAN_ERROR

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(span.spanId)}
        className="grid w-full grid-cols-[minmax(12rem,22rem)_1fr] items-center gap-3 px-3 py-1 text-left text-[0.75rem] outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-brand/40 aria-pressed:bg-brand/10"
      >
        <span
          className="flex min-w-0 items-center gap-1.5"
          style={{ paddingLeft: `${Math.min(span.depth, 12) * 0.75}rem` }}
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", error ? "bg-danger" : "bg-ok")}
            aria-hidden
          />
          <span className="truncate font-medium">{span.name}</span>
          <span className="truncate text-muted-foreground">{span.service}</span>
          {span.orphan && (
            <span className="shrink-0 border border-warn px-1 text-[0.625rem] text-warn">
              parent missing
            </span>
          )}
        </span>
        <span className="relative h-4">
          <span
            className={cn("absolute inset-y-0.5", error ? "bg-danger/70" : "bg-brand/60")}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
          <span
            className="absolute top-0 font-mono text-[0.625rem] text-muted-foreground"
            style={{ left: `min(calc(${left + width}% + 0.25rem), calc(100% - 3.5rem))` }}
          >
            {formatDuration(span.durationMs)}
          </span>
        </span>
      </button>
    </li>
  )
}
