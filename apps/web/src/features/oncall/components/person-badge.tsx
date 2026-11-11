import { cn } from "@/lib/utils"
import { colorFor, displayName, initials } from "../lib"
import type { Person } from "../schemas"

interface PersonBadgeProps {
  person: Person
  index?: number
  className?: string
}

export function PersonBadge({ person, index = 0, className }: PersonBadgeProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center font-mono text-[0.6875rem] font-semibold text-on-brand",
          colorFor(index)
        )}
      >
        {initials(person)}
      </span>
      <span className="truncate text-sm">{displayName(person)}</span>
    </span>
  )
}
