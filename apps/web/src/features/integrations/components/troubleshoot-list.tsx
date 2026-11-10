import { ChevronRight } from "lucide-react"

interface TroubleshootListProps {
  items: string[]
}

export function TroubleshootList({ items }: TroubleshootListProps) {
  return (
    <details className="group border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[0.8125rem] font-medium hover:bg-panel-2">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        No data coming in?
      </summary>
      <ul className="grid gap-1.5 px-3 pt-1 pb-3 text-[0.8125rem] leading-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="list-inside list-disc">
            {item}
          </li>
        ))}
      </ul>
    </details>
  )
}
