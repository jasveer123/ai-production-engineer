import { Badge } from "@/components/ui"
import { cn } from "@/lib/utils"
import type { ErrorFrame } from "../schemas"

interface StackFrameProps {
  frame: ErrorFrame
}

export function StackFrame({ frame }: StackFrameProps) {
  const start = (frame.line ?? 0) - (frame.context?.pre.length ?? 0)

  return (
    <li className={cn("grid gap-1 border border-line p-2", !frame.inApp && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[0.75rem]">
        <span className="font-semibold text-text">{frame.function ?? "<anonymous>"}</span>
        <span className="min-w-0 truncate text-muted-foreground">
          {frame.file ?? "?"}
          {frame.line !== null ? `:${frame.line}` : ""}
          {frame.column !== null ? `:${frame.column}` : ""}
        </span>
        {frame.inApp && <Badge variant="brand">in app</Badge>}
        {frame.mapped && <Badge variant="info">source map</Badge>}
      </div>
      {frame.context && (
        <ol className="overflow-x-auto rounded-md bg-sunken py-1 font-mono text-[0.75rem] leading-5">
          {[...frame.context.pre, frame.context.line, ...frame.context.post].map((code, i) => (
            <li
              key={i}
              className={cn(
                "flex gap-3 px-2 whitespace-pre",
                i === frame.context!.pre.length && "bg-danger-soft text-danger"
              )}
            >
              <span className="w-10 shrink-0 text-right text-muted-foreground">{start + i}</span>
              <span>{code}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
