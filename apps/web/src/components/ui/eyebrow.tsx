import * as React from "react"
import { cn } from "@/lib/utils"

type EyebrowProps = React.ComponentProps<"span">

export function Eyebrow({ className, ...props }: EyebrowProps) {
  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem] leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}
