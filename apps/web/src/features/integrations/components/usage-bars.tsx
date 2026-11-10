import { cn } from "@/lib/utils"
import type { HistogramBucket } from "../schemas"

interface UsageBarsProps {
  buckets: HistogramBucket[]
  label: string
  className?: string
  highlightIndex?: number
}

export function UsageBars({ buckets, label, className, highlightIndex }: UsageBarsProps) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.total))

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex items-end gap-px border-b border-line", className)}
    >
      {buckets.map((bucket, index) => {
        const height = bucket.total === 0 ? 2 : Math.max(4, (bucket.total / max) * 100)
        const errorShare = bucket.total ? (bucket.errors / bucket.total) * 100 : 0

        return (
          <span key={bucket.at} className="flex h-full min-w-0 flex-1 items-end">
            <span
              className={cn(
                "relative block w-full overflow-hidden transition-[height] duration-300",
                index === highlightIndex ? "bg-ai" : "bg-brand/60",
                bucket.total === 0 && "bg-line"
              )}
              style={{ height: `${height}%` }}
            >
              {errorShare > 0 && (
                <span
                  className="absolute inset-x-0 bottom-0 block bg-danger"
                  style={{ height: `${errorShare}%` }}
                />
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}
