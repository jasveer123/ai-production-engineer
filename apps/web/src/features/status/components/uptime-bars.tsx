interface UptimeBarsProps {
  days: { date: string; uptime: number | null }[]
}

const tone = (uptime: number | null) => {
  if (uptime === null) return "bg-line"
  if (uptime >= 99.5) return "bg-ok"
  if (uptime >= 95) return "bg-warn"
  return "bg-danger"
}

export function UptimeBars({ days }: UptimeBarsProps) {
  return (
    <div
      className="flex h-8 items-stretch gap-px"
      role="img"
      aria-label="Uptime for the last 90 days"
    >
      {days.map((day) => (
        <span
          key={day.date}
          title={`${day.date}: ${day.uptime === null ? "no data" : `${day.uptime}% up`}`}
          className={`min-w-0 flex-1 ${tone(day.uptime)}`}
        />
      ))}
    </div>
  )
}
