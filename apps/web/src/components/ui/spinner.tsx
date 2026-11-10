import * as React from "react"
import { cn } from "@/lib/utils"

type SpinnerProps = React.ComponentProps<"span">

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-brand",
        className
      )}
      {...props}
    />
  )
}
