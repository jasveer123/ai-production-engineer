import { Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

export type ChapterState = "done" | "active" | "pending"

interface StoryChapterProps {
  index: number
  title: string
  summary: string
  state: ChapterState
  last?: boolean
  children?: React.ReactNode
}

export function StoryChapter({ index, title, summary, state, last, children }: StoryChapterProps) {
  return (
    <li
      aria-current={state === "active" ? "step" : undefined}
      className="relative grid grid-cols-[2.25rem_1fr] gap-4"
    >
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "z-10 grid size-9 shrink-0 place-items-center border font-mono text-sm",
            state === "done" && "border-ok bg-ok/15 text-ok",
            state === "active" &&
              "border-brand bg-brand-soft text-brand-strong shadow-[0_0_1rem_var(--glow)]",
            state === "pending" && "border-line bg-panel text-muted-foreground"
          )}
        >
          {state === "done" ? (
            <Check className="size-4" />
          ) : state === "pending" ? (
            <Lock className="size-3.5" />
          ) : (
            index
          )}
        </span>
        {!last && <span className={cn("w-px flex-1", state === "done" ? "bg-ok/40" : "bg-line")} />}
      </div>
      <section aria-label={title} className={cn("grid min-w-0 gap-4 pb-10", last && "pb-0")}>
        <header className="grid gap-1">
          <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
            Chapter {index}
          </p>
          <h2
            className={cn(
              "font-heading text-xl font-semibold tracking-tight",
              state === "pending" && "text-muted-foreground"
            )}
          >
            {title}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{summary}</p>
        </header>
        {state !== "pending" && children}
      </section>
    </li>
  )
}
