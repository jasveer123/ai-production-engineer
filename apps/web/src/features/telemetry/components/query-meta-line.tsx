import { formatDateTime } from "@/lib/format/relative-time"
import type { QueryMeta } from "../explore-schemas"

interface QueryMetaLineProps {
  meta: QueryMeta
  shown: number
  noun: string
}

export function QueryMetaLine({ meta, shown, noun }: QueryMetaLineProps) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground">
      <span>
        {formatDateTime(meta.from)} to {formatDateTime(meta.to)}
      </span>
      <span>
        {meta.matched.toLocaleString()}
        {meta.matchedCapped ? "+" : ""} matching {noun}
        {meta.matchedCapped ? " (count capped)" : ""}
      </span>
      <span>
        {shown.toLocaleString()} shown{meta.truncated ? ", more available" : ""}
      </span>
      <span>{meta.tookMs} ms</span>
    </p>
  )
}
