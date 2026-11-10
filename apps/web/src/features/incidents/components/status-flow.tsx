import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { FLOW_STEPS } from "../constants"

interface StatusFlowProps {
  status: string
}

const SIDE_PATH: Record<string, string> = {
  validation_failed: "validation",
  verification_inconclusive: "monitoring",
  needs_attention: "detected",
  closed_without_fix: "detected",
}

export function StatusFlow({ status }: StatusFlowProps) {
  const mapped = SIDE_PATH[status] ?? status
  const current = FLOW_STEPS.findIndex((step) => step.status === mapped)
  const offTrack = status in SIDE_PATH

  return (
    <ol className="grid gap-2 sm:grid-cols-7" aria-label="Progress">
      {FLOW_STEPS.map((step, index) => {
        const done = index < current || (status === "resolved" && index === current)
        const active = index === current && status !== "resolved"

        return (
          <li
            key={step.status}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 border-t-2 pt-2 text-[0.75rem]",
              done && "border-ok text-ok",
              active && (offTrack ? "border-danger text-danger" : "border-brand text-brand-strong"),
              !done && !active && "border-line text-muted-foreground"
            )}
          >
            {done ? <Check className="size-3.5" /> : <span className="font-mono">{index + 1}</span>}
            <span className="truncate">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
