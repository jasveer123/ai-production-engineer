interface HeatmapGridProps {
  grid: number[][]
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function HeatmapGrid({ grid }: HeatmapGridProps) {
  const max = Math.max(1, ...grid.flat())
  return (
    <figure className="grid gap-2 overflow-x-auto" aria-label="Incidents by weekday and hour">
      <div className="grid min-w-[40rem] grid-cols-[2.5rem_repeat(24,1fr)] gap-0.5">
        {grid.map((row, day) => (
          <div key={DAYS[day]} className="contents">
            <span className="text-[0.75rem] text-muted-foreground">{DAYS[day]}</span>
            {row.map((count, hour) => (
              <span
                key={hour}
                title={`${DAYS[day]} ${hour}:00 · ${count} incident${count === 1 ? "" : "s"}`}
                className="block h-5 bg-brand"
                style={{ opacity: count ? 0.15 + (count / max) * 0.85 : 0.05 }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center text-[0.625rem] text-muted-foreground">
            {hour % 3 === 0 ? hour : ""}
          </span>
        ))}
      </div>
      <figcaption className="text-[0.75rem] text-muted-foreground">
        When incidents started, in your local time.
      </figcaption>
    </figure>
  )
}
