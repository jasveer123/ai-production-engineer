import * as React from "react"
import { ApiError } from "@/lib/api"
import type { LogLine } from "../schemas"
import { exploreService } from "../services"

export const TAIL_BUFFER = 1000
const POLL_MS = 1500
const RETRY_MS = 5000

export type TailItem =
  { kind: "line"; key: string; line: LogLine } | { kind: "gap"; key: string; reason: string }

export type TailStatus = "live" | "paused" | "reconnecting" | "invalid"

const gap = (reason: string): TailItem => ({
  kind: "gap",
  key: `gap-${Date.now()}-${Math.random()}`,
  reason,
})

export function useTail(workspaceId: string | undefined, query: string, paused: boolean) {
  const [items, setItems] = React.useState<TailItem[]>([])
  const [status, setStatus] = React.useState<TailStatus>("live")
  const [error, setError] = React.useState<string | null>(null)
  const cursor = React.useRef<number | null>(null)
  const failed = React.useRef(false)
  const scope = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!workspaceId || paused) return
    let fresh = scope.current !== `${workspaceId}\u0000${query}`
    if (fresh) {
      scope.current = `${workspaceId}\u0000${query}`
      cursor.current = null
    }
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      let delay = POLL_MS
      try {
        const result = await exploreService.tail(workspaceId, query, cursor.current)
        if (stopped) return
        const added: TailItem[] = []
        if (failed.current) added.push(gap("Connection restored. Resumed from the last line seen."))
        if (result.gap) added.push(gap("Too many new lines. Older lines in between were skipped."))
        failed.current = false
        cursor.current = result.cursor
        added.push(
          ...result.lines.map((line) => ({ kind: "line" as const, key: `l-${line.id}`, line }))
        )
        const reset = fresh
        fresh = false
        if (added.length || reset)
          setItems((prev) => [...(reset ? [] : prev), ...added].slice(-TAIL_BUFFER))
        setStatus("live")
        setError(null)
      } catch (err) {
        if (stopped) return
        if (err instanceof ApiError && err.status === 400) {
          setStatus("invalid")
          setError(err.message)
          return
        }
        failed.current = true
        delay = RETRY_MS
        setStatus("reconnecting")
      }
      if (!stopped) timer = setTimeout(tick, delay)
    }
    void tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [workspaceId, query, paused])

  return {
    items,
    status: paused ? ("paused" as const) : status,
    error,
    clear: () => setItems([]),
  }
}
