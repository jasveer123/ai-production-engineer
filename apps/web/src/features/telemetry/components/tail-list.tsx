import type { TailItem } from "../hooks"
import { LogRow } from "./log-row"

interface TailListProps {
  items: TailItem[]
}

export function TailList({ items }: TailListProps) {
  if (items.length === 0) {
    return (
      <p className="border border-dashed border-line p-6 text-[0.8125rem] text-muted-foreground">
        Waiting for new lines. They appear here the moment your apps send them.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-line border border-line bg-sunken" aria-live="polite">
      {items.map((item) =>
        item.kind === "line" ? (
          <LogRow key={item.key} line={item.line} />
        ) : (
          <li
            key={item.key}
            role="separator"
            className="bg-warn/10 px-3 py-1.5 text-center text-[0.75rem] text-warn"
          >
            {item.reason}
          </li>
        )
      )}
    </ul>
  )
}
