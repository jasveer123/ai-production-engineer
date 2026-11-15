import * as React from "react"
import { cn } from "@/lib/utils"

type EyebrowProps = React.ComponentProps<"span">

export function Eyebrow({ className, ...props }: EyebrowProps) {
  return (
    <span
      className={cn("text-xs leading-4 font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}
