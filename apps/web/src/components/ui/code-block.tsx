import * as React from "react"
import { cn } from "@/lib/utils"

type CodeBlockProps = React.ComponentProps<"pre">

export function CodeBlock({ className, ...props }: CodeBlockProps) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border border-line bg-sunken p-3 font-mono text-[0.8125rem] leading-5 text-text",
        className
      )}
      {...props}
    />
  )
}
