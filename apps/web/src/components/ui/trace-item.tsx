import * as React from "react"
import { cn } from "@/lib/utils"

type TraceTone = "default" | "ai" | "danger" | "ok" | "warn"

const toneText: Record<TraceTone, string> = {
  default: "text-text",
  ai: "text-ai-ink",
  danger: "text-danger",
  ok: "text-ok",
  warn: "text-warn",
}

const toneLine: Record<TraceTone, string> = {
  default: "bg-line-strong",
  ai: "bg-ai",
  danger: "bg-danger",
  ok: "bg-ok",
  warn: "bg-warn",
}

interface TraceItemProps {
  time: string
  tone?: TraceTone
  active?: boolean
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function TraceItem({
  time,
  tone = "default",
  active,
  icon,
  action,
  className,
  children,
}: TraceItemProps) {
  const isMuted = tone === "default" && !active

  return (
    <li
      className={cn(
        "group/trace relative grid grid-cols-[4rem_1.25rem_1fr] items-center",
        className
      )}
    >
      <span
        className={cn(
          "font-mono text-[0.8125rem]",
          isMuted ? "text-muted-foreground" : toneText[tone]
        )}
      >
        {time}
      </span>
      <span aria-hidden className="relative h-full self-stretch">
        <span className={cn("absolute inset-y-0 left-0 w-px", toneLine[tone])} />
        <span className={cn("absolute top-1/2 left-0 h-px w-3", toneLine[tone])} />
      </span>
      <div
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-[0.8125rem] transition-colors group-hover/trace:bg-panel-2",
          active && "bg-ai/10 group-hover/trace:bg-ai/15",
          toneText[active ? "ai" : tone]
        )}
      >
        {icon && (
          <span className="grid size-5 shrink-0 place-items-center [&_svg]:size-4">{icon}</span>
        )}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {action}
      </div>
    </li>
  )
}
