"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface UptimeBarsProps {
  days: { date: string; uptime: number | null }[]
}

const tone = (uptime: number | null) => {
  if (uptime === null) return "bg-line"
  if (uptime >= 99.5) return "bg-ok"
  if (uptime >= 95) return "bg-warn"
  return "bg-danger"
}

const describe = (day: { date: string; uptime: number | null }) =>
  `${day.date}: ${day.uptime === null ? "no data" : `${day.uptime}% up`}`

export function UptimeBars({ days }: UptimeBarsProps) {
  const [active, setActive] = React.useState<number | null>(null)
  const [pinned, setPinned] = React.useState<number | null>(null)
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const shown = pinned ?? active
  const focus = (index: number) => refs.current[(index + days.length) % days.length]?.focus()

  const onKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowLeft") focus(index - 1)
    else if (event.key === "ArrowRight") focus(index + 1)
    else if (event.key === "Escape") {
      setPinned(null)
      setActive(null)
    } else return
    event.preventDefault()
  }

  return (
    <div className="grid gap-1.5">
      <div
        role="toolbar"
        aria-label="Daily uptime for the last 90 days"
        className="flex h-8 items-stretch gap-px"
        onMouseLeave={() => setActive(null)}
      >
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            ref={(node) => {
              refs.current[index] = node
            }}
            aria-label={describe(day)}
            aria-pressed={pinned === index}
            tabIndex={index === days.length - 1 ? 0 : -1}
            className={cn(
              "min-w-0 flex-1 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-brand",
              tone(day.uptime),
              shown === index && "opacity-70"
            )}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            onClick={() => setPinned(pinned === index ? null : index)}
            onKeyDown={(event) => onKey(event, index)}
          />
        ))}
      </div>
      <p className="h-4 font-mono text-[0.6875rem] text-muted-foreground" aria-live="polite">
        {shown === null ? "" : describe(days[shown]!)}
      </p>
    </div>
  )
}
