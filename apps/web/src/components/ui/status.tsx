import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusVariants = cva("inline-flex items-center gap-2 text-[0.8125rem] leading-5", {
  variants: {
    state: {
      idle: "text-muted-foreground",
      live: "text-ok",
      waiting: "text-warn",
      failed: "text-danger",
    },
  },
  defaultVariants: { state: "idle" },
})

const dotColor = {
  idle: "bg-line-strong",
  live: "bg-ok",
  waiting: "bg-warn",
  failed: "bg-danger",
} as const

interface StatusProps extends React.ComponentProps<"span">, VariantProps<typeof statusVariants> {}

export function Status({ state = "idle", className, children, ...props }: StatusProps) {
  const current = state ?? "idle"

  return (
    <span className={cn(statusVariants({ state }), className)} {...props}>
      <span
        className={cn(
          "relative size-2 shrink-0 rounded-full",
          dotColor[current],
          current === "waiting" && "animate-[blink_1.4s_ease-in-out_infinite]"
        )}
      >
        {current === "live" && (
          <span className="absolute inset-0 animate-[ping_1.8s_ease-out_infinite] rounded-full bg-ok" />
        )}
      </span>
      {children}
    </span>
  )
}
