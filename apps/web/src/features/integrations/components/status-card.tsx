import * as React from "react"
import StatusLanes from "@/assets/svg/status-lanes.svg"
import { Card, Tag } from "@/components/ui"
import { cn } from "@/lib/utils"

interface StatusCardProps {
  tag: string
  title: string
  note: string
  tone: "warn" | "danger"
  action?: React.ReactNode
}

export function StatusCard({ tag, title, note, tone, action }: StatusCardProps) {
  return (
    <Card
      ticked
      className={cn("gap-3", tone === "warn" ? "[--tick:var(--warn)]" : "[--tick:var(--danger)]")}
    >
      <Tag
        className={cn(
          "absolute -top-3 left-5 z-10",
          tone === "warn" ? "border-warn text-warn" : "border-danger text-danger"
        )}
      >
        {tag}
      </Tag>
      <div className="flex items-center gap-4 px-5 pt-2">
        <StatusLanes
          className={cn("h-14 w-28 shrink-0", tone === "warn" ? "text-warn" : "text-danger")}
        />
        <div className="grid min-w-0 gap-1">
          <h3 className="font-heading text-[0.9375rem] leading-snug font-semibold">{title}</h3>
          <p className="text-[0.8125rem] leading-5 text-muted-foreground">{note}</p>
        </div>
      </div>
      {action && <div className="px-5">{action}</div>}
    </Card>
  )
}
