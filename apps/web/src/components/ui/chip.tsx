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
        "inline-flex h-8 cursor-pointer items-center gap-1.5 border border-line-strong bg-panel px-3 text-[0.8125rem] text-text transition-colors outline-none hover:bg-panel-2 focus-visible:ring-3 focus-visible:ring-brand/40 aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:font-semibold aria-pressed:text-brand-strong",
        className
      )}
      {...props}
    />
  )
}
