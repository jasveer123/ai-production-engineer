import * as React from "react"
import { cn } from "@/lib/utils"

type TagProps = React.ComponentProps<"span">

export function Tag({ className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
