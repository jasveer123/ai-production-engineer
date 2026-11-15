import { cn } from "@/lib/utils"
import { STATE_LABEL, STATE_TONE } from "../constants"
import type { PublicResource as PublicResourceData } from "../schemas"
import { UptimeBars } from "./uptime-bars"

interface PublicResourceProps {
  resource: PublicResourceData
}

export function PublicResource({ resource }: PublicResourceProps) {
  const history = resource.showHistory && resource.days.length > 0

  return (
    <div className="grid gap-2 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="font-semibold">{resource.name}</h3>
          {resource.explanation && (
            <p className="text-[0.8125rem] text-muted-foreground">{resource.explanation}</p>
          )}
        </div>
        <span className={cn("text-[0.8125rem] font-medium", STATE_TONE[resource.state])}>
          {STATE_LABEL[resource.state] ?? resource.state}
        </span>
      </div>
      {history && (
        <>
          <UptimeBars days={resource.days} />
          <div className="flex justify-between text-[0.75rem] text-muted-foreground">
            <span>90 days ago</span>
            <span>{resource.uptime === null ? "No data yet" : `${resource.uptime}% uptime`}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </div>
  )
}
