import * as React from "react"
import { cn } from "@/lib/utils"

type TraceProps = React.ComponentProps<"ol">

export function Trace({ className, ...props }: TraceProps) {
  return <ol className={cn("relative grid gap-1", className)} {...props} />
}
