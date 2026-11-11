import * as React from "react"
import { cn } from "@/lib/utils"

interface ChipProps extends React.ComponentProps<"button"> {
  selected?: boolean
}

export function Chip({ selected, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 text-[0.8125rem] text-muted-foreground transition-colors outline-none hover:bg-panel-2 hover:text-text focus-visible:ring-2 focus-visible:ring-brand/50 aria-pressed:border-line-strong aria-pressed:bg-panel-2 aria-pressed:font-medium aria-pressed:text-text",
        className
      )}
      {...props}
    />
  )
}
