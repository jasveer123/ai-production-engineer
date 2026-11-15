import { Badge, Eyebrow } from "@/components/ui"
import { RUN_KIND_LABEL, RUN_STATUS_VARIANT } from "../constants"
import { formatDuration } from "../lib"
import type { ValidationRun } from "../schemas"

interface ValidationRunsProps {
  runs: ValidationRun[]
}

export function ValidationRuns({ runs }: ValidationRunsProps) {
  if (runs.length === 0) return null

  return (
    <section className="grid gap-2">
      <Eyebrow>Checks on the fix</Eyebrow>
      <ul className="grid gap-2">
        {runs.map((run) => (
          <li
            key={run.id}
            className="flex flex-wrap items-center gap-3 border border-line px-3 py-2"
          >
            <Badge
              variant={
                RUN_STATUS_VARIANT[run.status as keyof typeof RUN_STATUS_VARIANT] ?? "default"
              }
            >
              {run.status}
            </Badge>
            <span className="text-[0.8125rem]">{RUN_KIND_LABEL[run.kind] ?? run.kind}</span>
            <span className="ml-auto font-mono text-[0.75rem] text-muted-foreground">
              attempt {run.attempt} · {formatDuration(run.durationMs)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
