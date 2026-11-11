"use client"

import * as React from "react"
import { Pause, Play } from "lucide-react"
import { Button, Chip } from "@/components/ui"
import type { RumReplay } from "../schemas"

interface ReplayPlayerProps {
  replay: RumReplay
  startMs: number
  endMs: number
  seekTo?: number | null
}

const SPEEDS = [1, 2, 4] as const
const RIPPLE_MS = 700

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ReplayPlayer({ replay, startMs, endMs, seekTo }: ReplayPlayerProps) {
  const frame = React.useRef<HTMLIFrameElement>(null)
  const box = React.useRef<HTMLDivElement>(null)
  const [time, setTime] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState<number>(1)
  const [width, setWidth] = React.useState(0)
  const viewport = replay.viewport ?? { w: 1280, h: 720 }
  const duration = Math.max(
    1000,
    endMs - startMs,
    ...replay.snapshots.map((s) => s.ts - startMs),
    ...replay.moves.map((m) => m.ts - startMs)
  )
  const now = startMs + time

  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    const tick = (at: number) => {
      const delta = (at - last) * speed
      last = at
      setTime((t) => {
        const next = t + delta
        if (next >= duration) {
          setPlaying(false)
          return duration
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration])

  const [lastSeek, setLastSeek] = React.useState(seekTo)
  if (seekTo !== lastSeek) {
    setLastSeek(seekTo)
    if (seekTo !== null && seekTo !== undefined)
      setTime(Math.min(duration, Math.max(0, seekTo - startMs)))
  }

  const snapshot = React.useMemo(() => {
    let current = replay.snapshots[0]
    for (const s of replay.snapshots) if (s.ts <= now) current = s
    return current
  }, [replay.snapshots, now])

  const pointer = React.useMemo(() => {
    let m: { x: number; y: number } | null = null
    let scroll = 0
    let click: { x: number; y: number; ts: number } | null = null
    for (const move of replay.moves) {
      if (move.ts > now) break
      if (move.t === "s") scroll = move.y
      else m = { x: move.x, y: move.y }
      if (move.t === "c") click = { x: move.x, y: move.y, ts: move.ts }
    }
    return { m, scroll, click: click && now - click.ts < RIPPLE_MS ? click : null }
  }, [replay.moves, now])

  React.useEffect(() => {
    frame.current?.contentWindow?.scrollTo(0, pointer.scroll)
  }, [pointer.scroll, snapshot])

  const scale = width > 0 ? Math.min(1, width / viewport.w) : 1
  const place = (p: { x: number; y: number }) => ({
    left: p.x * scale,
    top: (p.y - pointer.scroll) * scale,
  })

  return (
    <div className="grid gap-3">
      <div ref={box} className="w-full overflow-hidden border border-line bg-sunken">
        {snapshot ? (
          <div className="relative" style={{ height: viewport.h * scale }}>
            <iframe
              ref={frame}
              title="Session replay"
              sandbox="allow-same-origin"
              srcDoc={snapshot.html}
              scrolling="no"
              className="absolute top-0 left-0 border-0 bg-white"
              style={{
                width: viewport.w,
                height: viewport.h,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            />
            {pointer.m && (
              <span
                aria-hidden
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"
                style={place(pointer.m)}
              />
            )}
            {pointer.click && (
              <span
                aria-hidden
                className="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-brand/30"
                style={place(pointer.click)}
              />
            )}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No picture of the page was recorded for this session.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            if (time >= duration) setTime(0)
            setPlaying((p) => !p)
          }}
        >
          {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
        </Button>
        <input
          type="range"
          aria-label="Position"
          className="min-w-40 flex-1 accent-[var(--brand)]"
          min={0}
          max={Math.round(duration)}
          value={Math.round(time)}
          onChange={(e) => setTime(Number(e.target.value))}
        />
        <span className="font-mono text-[0.75rem] text-muted-foreground">
          {clock(time)} / {clock(duration)}
        </span>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <Chip key={s} selected={speed === s} onClick={() => setSpeed(s)}>
              {s}x
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
