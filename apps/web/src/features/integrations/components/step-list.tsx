import type { IntegrationStep } from "../catalog"
import { SnippetBlock } from "./snippet-block"

interface StepListProps {
  steps: IntegrationStep[]
  startAt?: number
}

export function StepList({ steps, startAt = 1 }: StepListProps) {
  return (
    <ol className="grid gap-5">
      {steps.map((step, index) => (
        <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3">
          <span className="grid size-7 place-items-center border border-line-strong font-mono text-[0.75rem] text-muted-foreground">
            {index + startAt}
          </span>
          <div className="grid min-w-0 gap-2">
            <div className="grid gap-0.5">
              <h4 className="text-sm leading-7 font-semibold">{step.title}</h4>
              {step.description && (
                <p className="text-[0.8125rem] leading-5 text-muted-foreground">
                  {step.description}
                </p>
              )}
            </div>
            {step.code && <SnippetBlock code={step.code} />}
          </div>
        </li>
      ))}
    </ol>
  )
}
