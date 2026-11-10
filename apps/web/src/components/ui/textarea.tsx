import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-y rounded-md border border-line-strong bg-panel-2 px-3 py-2 text-sm text-text transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-soft",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
