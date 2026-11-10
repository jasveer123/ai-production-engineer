import { Spinner } from "@/components/ui"
import type { LogLine } from "../schemas"
import { LogRow } from "./log-row"

interface LogListProps {
  lines: LogLine[]
  loading: boolean
  emptyText: string
}

export function LogList({ lines, loading, emptyText }: LogListProps) {
  if (lines.length === 0) {
    return (
      <div className="flex items-center gap-3 border border-dashed border-line p-6 text-[0.8125rem] text-muted-foreground">
        {loading && <Spinner />} {loading ? "Loading logs" : emptyText}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-line border border-line bg-sunken">
      {lines.map((line) => (
        <LogRow key={line.id} line={line} />
      ))}
    </ul>
  )
}
