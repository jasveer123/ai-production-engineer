import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SetupStep {
  label: string
  href: string
  done: boolean
}

interface SetupPathProps {
  steps: SetupStep[]
}

export function SetupPath({ steps }: SetupPathProps) {
  const finished = steps.filter((step) => step.done).length
  if (finished === steps.length) return null

  return (
    <nav
      aria-label="Setup"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-line bg-panel px-4 py-3 text-[0.8125rem]"
    >
      <span className="font-medium">
        Setup {finished}/{steps.length}
      </span>
      {steps.map((step, index) => (
        <Link
          key={step.label}
          href={step.href}
          className={cn(
            "flex items-center gap-1.5 outline-none hover:text-text focus-visible:text-text",
            step.done ? "text-muted-foreground" : "text-brand-strong"
          )}
        >
          {step.done ? (
            <Check className="size-3.5 text-ok" aria-hidden />
          ) : (
            <span className="font-mono text-xs">{index + 1}</span>
          )}
          {step.label}
        </Link>
      ))}
    </nav>
  )
}
