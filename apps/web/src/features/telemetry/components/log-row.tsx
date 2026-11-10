"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui"
import { formatClockTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import type { LogLine } from "../schemas"

const LEVEL_VARIANT: Record<string, "destructive" | "warning" | "default"> = {
  error: "destructive",
  fatal: "destructive",
  warn: "warning",
}

interface LogRowProps {
  line: LogLine
}

export function LogRow({ line }: LogRowProps) {
  const [open, setOpen] = React.useState(false)
  const details = {
    service: line.service,
    environment: line.environment,
    host: line.host,
    way: line.way,
    traceId: line.traceId,
    spanId: line.spanId,
    ...(line.attributes ?? {}),
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid w-full grid-cols-[1rem_4.5rem_3.5rem_9rem_1fr] items-baseline gap-2 px-3 py-1.5 text-left font-mono text-[0.75rem] outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40"
      >
        <ChevronRight
          className={cn(
            "size-3 self-center text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="text-muted-foreground">{formatClockTime(line.ts)}</span>
        <Badge variant={LEVEL_VARIANT[line.level] ?? "default"}>{line.level}</Badge>
        <span className="truncate text-muted-foreground" title={line.service}>
          {line.service}
        </span>
        <span className={cn("min-w-0", open ? "break-words whitespace-pre-wrap" : "truncate")}>
          {line.message}
        </span>
      </button>
      {open && (
        <pre className="mx-3 mb-2 overflow-x-auto border border-line bg-sunken p-3 font-mono text-[0.75rem] leading-5">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </li>
  )
}
