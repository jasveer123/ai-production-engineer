import { Badge } from "@/components/ui"
import type { Step } from "../schemas"

interface PolicyStepsProps {
  steps: Step[]
}

export function PolicySteps({ steps }: PolicyStepsProps) {
  return (
    <ol className="grid gap-2">
      {steps.map((step, index) => (
        <li key={index} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-[0.75rem] text-muted-foreground">
            {index === 0 ? "Immediately" : `After ${step.waitMinutes} min`}
          </span>
          {step.targets.map((target, i) => (
            <Badge key={i}>{target.label}</Badge>
          ))}
          <span className="text-[0.75rem] text-muted-foreground">
            by {step.channels.join(", ")}
          </span>
        </li>
      ))}
    </ol>
  )
}
