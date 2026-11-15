import { Minus, Plus } from "lucide-react"
import { Button, Eyebrow } from "@/components/ui"
import type { FacetValue } from "../explore-schemas"

interface FacetGroupProps {
  title: string
  values: FacetValue[]
  onInclude: (value: string) => void
  onExclude: (value: string) => void
}

export function FacetGroup({ title, values, onInclude, onExclude }: FacetGroupProps) {
  if (values.length === 0) return null
  const max = Math.max(1, ...values.map((value) => value.count))

  return (
    <div className="grid gap-1.5">
      <Eyebrow>{title}</Eyebrow>
      <ul className="grid gap-0.5">
        {values.map((item) => (
          <li key={item.value} className="group relative flex items-center gap-1 text-[0.75rem]">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-brand/10"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
            <span className="relative min-w-0 flex-1 truncate px-1 font-mono">{item.value}</span>
            <span className="relative font-mono text-muted-foreground">{item.count}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Only ${item.value}`}
              className="relative"
              onClick={() => onInclude(item.value)}
            >
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Exclude ${item.value}`}
              className="relative"
              onClick={() => onExclude(item.value)}
            >
              <Minus />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
