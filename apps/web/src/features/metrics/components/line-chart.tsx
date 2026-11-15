"use client"

import * as React from "react"
import { formatDateTime } from "@/lib/format/relative-time"
import { formatValue } from "../lib/format"
import type { MetricSeries } from "../schemas"

interface LineChartProps {
  series: MetricSeries
  area?: boolean
}

const TOKENS = [
  "--brand",
  "--ai",
  "--ok",
  "--info",
  "--warn",
  "--danger",
  "--muted-foreground",
  "--text",
]
const HEIGHT = 128

export function LineChart({ series, area = false }: LineChartProps) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const wrap = React.useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = React.useState<number | null>(null)
  const groups = React.useMemo(
    () => series.groups ?? [{ key: series.name, buckets: series.buckets }],
    [series.groups, series.name, series.buckets]
  )
  const length = groups[0]?.buckets.length ?? 0
  const max = Math.max(1e-9, ...groups.flatMap((g) => g.buckets.map((b) => b.value ?? 0)))

  React.useEffect(() => {
    const el = canvas.current
    const box = wrap.current
    if (!el || !box || length === 0) return
    const style = getComputedStyle(document.documentElement)
    const colors = TOKENS.map((t) => style.getPropertyValue(t).trim() || "currentColor")
    const dpr = window.devicePixelRatio || 1
    const width = box.clientWidth
    el.width = width * dpr
    el.height = HEIGHT * dpr
    const ctx = el.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, HEIGHT)
    const x = (i: number) => ((i + 0.5) / length) * width
    const y = (v: number) => HEIGHT - 4 - (v / max) * (HEIGHT - 12)
    groups.forEach((group, gi) => {
      ctx.strokeStyle = colors[gi % colors.length]!
      ctx.lineWidth = 2
      ctx.beginPath()
      let pen = false
      group.buckets.forEach((b, i) => {
        if (b.value === null) {
          pen = false
          return
        }
        if (pen) ctx.lineTo(x(i), y(b.value))
        else ctx.moveTo(x(i), y(b.value))
        pen = true
      })
      ctx.stroke()
      if (!area) return
      ctx.fillStyle = colors[gi % colors.length]!
      ctx.globalAlpha = 0.15
      group.buckets.forEach((b, i) => {
        if (b.value !== null)
          ctx.fillRect(x(i) - width / length / 2, y(b.value), width / length, HEIGHT - y(b.value))
      })
      ctx.globalAlpha = 1
    })
    if (hovered !== null) {
      ctx.strokeStyle = colors[6]!
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x(hovered), 0)
      ctx.lineTo(x(hovered), HEIGHT)
      ctx.stroke()
    }
  }, [area, groups, hovered, length, max])

  const active = hovered === null ? null : hovered
  const left = active === null ? 0 : ((active + 0.5) / Math.max(1, length)) * 100

  return (
    <div className="grid gap-2">
      <div
        ref={wrap}
        className="relative border-b border-line"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const i = Math.floor(((event.clientX - rect.left) / rect.width) * length)
          setHovered(Math.min(length - 1, Math.max(0, i)))
        }}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${series.name} by group over time`}
          className="block h-32 w-full"
        />
        {active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 grid w-52 -translate-x-1/2 -translate-y-full gap-1 border border-line-strong bg-panel p-3 text-[0.75rem] shadow-lg"
            style={{ left: `clamp(6.5rem, ${left}%, calc(100% - 6.5rem))` }}
          >
            <span className="font-mono text-muted-foreground">
              {formatDateTime(groups[0]!.buckets[active]!.at)}
            </span>
            {groups.map((group, gi) => (
              <span key={group.key} className="flex justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: `var(${TOKENS[gi % TOKENS.length]})` }}
                  />
                  {group.key}
                </span>
                <span className="font-mono">
                  {group.buckets[active]?.value == null
                    ? "—"
                    : formatValue(group.buckets[active]!.value!, series.unit)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      {series.groups && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
          {groups.map((group, gi) => (
            <li key={group.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(${TOKENS[gi % TOKENS.length]})` }}
              />
              {group.key}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
