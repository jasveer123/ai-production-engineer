import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StoryStep {
  title: string
  text: string
  done?: boolean
}

interface StoryStepsProps {
  heading: string
  steps: StoryStep[]
  action?: ReactNode
}

export function StorySteps({ heading, steps, action }: StoryStepsProps) {
  return (
    <section className="grid gap-5 border border-dashed border-line-strong bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">{heading}</h2>
        {action}
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs",
                step.done
                  ? "border-ok bg-ok-soft text-ok"
                  : "border-line-strong text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{step.title}</span>
              <span className="text-[0.8125rem] leading-5 text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
