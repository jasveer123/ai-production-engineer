import * as React from "react"
import { cn } from "@/lib/utils"

type TagProps = React.ComponentProps<"span">

export function Tag({ className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-brand bg-bg px-2 py-0.5 font-mono text-[0.6875rem] font-medium tracking-[0.08em] text-brand uppercase",
        className
      )}
      {...props}
    />
  )
}
